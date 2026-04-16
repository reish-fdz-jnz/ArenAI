export interface UserData {
    id?: number;
    name: string;
    email: string;
    username: string;
    userRole?: string;
    avatar?: string; // Added as it's used in BattleLobby
}

export interface AppPage {
    url: string;
    iosIcon: string;
    mdIcon: string;
    titleKey: string;
}
