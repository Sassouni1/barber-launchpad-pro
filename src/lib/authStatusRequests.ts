/** Coordinate status reads without letting old identities overwrite a session. */
export class AuthStatusRequests {
  private userId: string | null = null;
  private version = 0;
  private resolved = false;

  activate(userId: string | null) {
    if (this.userId === userId) return false;
    this.userId = userId;
    this.version += 1;
    this.resolved = false;
    return true;
  }

  begin(userId: string) {
    return { userId, version: ++this.version };
  }

  isActive(userId: string) { return this.userId === userId; }

  isCurrent(request: { userId: string; version: number }) {
    return this.userId === request.userId && this.version === request.version;
  }

  resolve(request: { userId: string; version: number }) {
    if (!this.isCurrent(request)) return false;
    this.resolved = true;
    return true;
  }

  get hasResolved() { return this.resolved; }

  invalidate() { this.version += 1; }
}