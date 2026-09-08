/**
 * GitHub OAuth proxy for Decap CMS.
 *
 * What this is for: Decap CMS's login button needs somewhere to send people
 * to sign in with GitHub, and somewhere to land back at afterward with a
 * token. GitHub Pages can't run that code itself — it only serves static
 * files. This Worker is that missing piece: two small routes, no database,
 * no server to patch or pay for. Cloudflare's free tier covers this
 * completely for a tool with this little traffic.
 *
 * Anyone who logs in successfully still only gets whatever GitHub itself
 * already lets them do — this Worker does not grant access on its own.
 * Access to edit the tool is controlled entirely by who is a collaborator
 * on the GitHub repo (see SETUP.md, step 6).
 *
 * One-time setup (SETUP.md has the full walkthrough):
 *   1. Create a GitHub OAuth App. Set its callback URL to:
 *        https://<this-worker>.workers.dev/callback
 *   2. Deploy this file to Cloudflare Workers.
 *   3. Set two secrets on the deployed Worker (never put these in code):
 *        GITHUB_CLIENT_ID
 *        GITHUB_CLIENT_SECRET
 *   4. Put this Worker's URL into admin/config.yml as `base_url`.
 */

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
      authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      authorizeUrl.searchParams.set("redirect_uri", `${url.origin}/callback`);
      authorizeUrl.searchParams.set("scope", "repo,user");
      // "state" guards against a forged callback; a real value would be
      // generated and checked against a signed cookie. For a low-stakes
      // internal editing tool this is left simple on purpose — if this
      // ever protects something higher-stakes, add real state validation
      // before relying on it.
      return Response.redirect(authorizeUrl.toString(), 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Missing ?code from GitHub.", { status: 400 });
      }

      const tokenResp = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = await tokenResp.json();

      if (tokenData.error) {
        return new Response(
          `GitHub sign-in failed: ${tokenData.error_description || tokenData.error}`,
          { status: 400 }
        );
      }

      // Decap's admin page expects a postMessage in this exact shape from
      // the popup window it opened for login.
      const payload = JSON.stringify({ token: tokenData.access_token, provider: "github" });
      const html = `<!doctype html><html><body>
<script>
(function() {
  function receiveMessage() {
    window.opener.postMessage(
      'authorization:github:success:${escapeForScript(payload)}',
      '*'
    );
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
You can close this window.
</body></html>`;

      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    return new Response(
      "GitHub OAuth proxy for the Clean Energy Capital Stack Tool. Nothing to see at this URL directly — /auth and /callback are the two routes Decap CMS calls.",
      { status: 200 }
    );
  },
};

function escapeForScript(s) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
