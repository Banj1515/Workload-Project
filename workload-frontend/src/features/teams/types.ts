export type TeamItem = {
    id: string;
    name: string;
    description?: string | null;
    memberCount?: number;
};

export type TeamFormData = {
    name: string;
    description: string;
};

export type TeamMember = {
    userId: string;
    displayName: string;
    email: string;
};