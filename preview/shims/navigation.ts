import { back, match, navigate, usePath } from "./router";
export function usePathname() { return usePath(); }
export function useRouter() {
  return { push: (to: string) => navigate(to), replace: (to: string) => navigate(to, true), back, refresh: () => {}, prefetch: () => {} };
}
export function useParams<T extends Record<string, string>>() { return match(usePath()).params as T; }
export function useSearchParams() { return new URLSearchParams(); }
