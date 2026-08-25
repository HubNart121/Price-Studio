export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface UserIdentity {
  email: string;
  name: string | null;
  image: string | null;
}
