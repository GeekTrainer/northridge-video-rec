// Tiny HTTP mock helpers for exercising vertical API handlers without booting
// a real server (the vertical servers embed Vite, which is heavy to start).
// Not a test file itself (no .test suffix), so the runner won't execute it.

export function makeReq(method, url) {
  return { method, url };
}

export function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk) {
      if (chunk !== undefined) this.body += chunk;
      this.ended = true;
    },
    json() {
      return JSON.parse(this.body);
    },
  };
}
