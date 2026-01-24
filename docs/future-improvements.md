# Future Improvements

## Visitor Tracking for Public Profile Chat

**Current:** IP-based tracking

**Consideration:** Hybrid approach using session ID cookies with IP fallback

### Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| IP-based | Works in incognito, no cookie consent needed | Shared IPs group multiple visitors, VPN/mobile IP changes |
| Cookie-based | Unique per browser, consistent across networks | Lost in incognito, can be cleared, may need consent |
| Hybrid (cookie + IP fallback) | Best of both | Added complexity |

### Potential Implementation

```typescript
// Pseudocode
function getVisitorIdentifier(req: FastifyRequest): string {
  const sessionCookie = req.cookies.visitorSession;

  if (sessionCookie) {
    // Verify signed cookie and return session ID
    return verifyAndGetSessionId(sessionCookie);
  }

  // Fallback to IP for incognito/no-cookie scenarios
  return req.ip;
}
```

### When to Implement

Consider implementing when:
- Analytics show significant shared-IP grouping issues
- Need more accurate unique visitor counts
- Adding other cookie-based features anyway

---

## Other Ideas

_Add future improvement ideas here as they come up._
