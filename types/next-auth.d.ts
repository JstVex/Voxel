import "next-auth";

interface GitHubProfile {
    id: number;
    login: string;
    avatar_url: string;
    name: string | null;
    email: string | null;
    [key: string]: any;
}

declare module "next-auth" {
    interface Session {
        accessToken?: string;
        user: {
            id?: string;
            login?: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
        }
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        accessToken?: string;
        githubId?: string;
        login?: string;
    }
}