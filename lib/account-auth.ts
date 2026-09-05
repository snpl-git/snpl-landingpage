export function shouldRedirectAccountRequest(pathname: string, userId: string | null) {
  return pathname.startsWith('/account') && !userId
}
