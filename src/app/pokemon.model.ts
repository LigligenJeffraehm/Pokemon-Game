export interface Pokemon {
  _id?: string;
  name: string;
  type: string;
  level: number;
  nature: string;
  caughtBy?: string;
}

export interface User {
  _id?: string;
  username: string;
}