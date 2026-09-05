export function checkoutOwnerMatches(orderUserId: string | null, verifiedUserId: string | null) {
  return orderUserId === verifiedUserId
}
