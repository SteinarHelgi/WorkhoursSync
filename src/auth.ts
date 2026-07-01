import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      authorization: {
        params: {
          // access_type=offline + prompt=consent are required to get a
          // refresh_token back on first sign-in, which we need to call the
          // Calendar API later without the user being present.
          // Full "calendar" scope (not just calendar.events) is required
          // because we create a dedicated calendar for the user, not just
          // events on an existing one.
          access_type: "offline",
          prompt: "consent",
          scope: "openid email profile https://www.googleapis.com/auth/calendar",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    // The adapter only writes tokens the first time an Account row is
    // created for a provider+providerAccountId - on every later sign-in it
    // reuses the existing row untouched. Since prompt=consent forces Google
    // to issue a fresh refresh_token on every sign-in, persist it here too,
    // otherwise a revoked/expired refresh_token can never be replaced short
    // of manually deleting the Account row.
    async signIn({ account }) {
      if (account?.provider !== "google" || !account.refresh_token) return;
      await prisma.account.updateMany({
        where: { provider: "google", providerAccountId: account.providerAccountId },
        data: {
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
          scope: account.scope,
          token_type: account.token_type,
          id_token: account.id_token,
        },
      });
    },
  },
});
