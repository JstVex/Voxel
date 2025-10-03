import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";

interface GitHubProfile {
    id: number;
    login: string;
    avatar_url: string;
    name: string | null;
    email: string | null;
}

const handler = NextAuth({
    providers: [
        GithubProvider({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
            authorization: {
                params: {
                    scope: 'read:user repo',
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            if (account) {
                token.accessToken = account.access_token;
            }
            if (profile) {
                const githubProfile = profile as GitHubProfile;
                token.githubId = githubProfile.id.toString();
                token.login = githubProfile.login;
            }
            return token;
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken as string;
            if (session.user) {
                session.user.id = token.githubId as string;
                session.user.login = token.login as string;
            }
            return session;
        },
    },
    pages: {
        signIn: '/auth/signin',
    },
});

export { handler as GET, handler as POST };