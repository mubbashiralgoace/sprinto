import { AUTH_COOKIE, AUTH_REFRESH_COOKIE } from '@/features/auth/constants';

export const authCookieOptions = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 30,
};

type SetCookie = (name: string, value: string, options: typeof authCookieOptions) => void;

export const setAuthCookies = (setCookie: SetCookie, accessToken: string, refreshToken: string) => {
  setCookie(AUTH_COOKIE, accessToken, authCookieOptions);
  setCookie(AUTH_REFRESH_COOKIE, refreshToken, authCookieOptions);
};
