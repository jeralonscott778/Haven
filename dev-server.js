/* Local preview only:  node dev-server.js  then open http://localhost:3000
   (Vercel does not use this file.) */
const http = require("http"), fs = require("fs"), path = require("path");
const api = require("./api/app.js");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".json": "application/json" };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/app") {
    let raw = "";
    req.on("data", c => (raw += c));
    req.on("end", () => {
      req.query = Object.fromEntries(u.searchParams);
      const ct = req.headers["content-type"] || "";
      try { req.body = ct.includes("json") ? JSON.parse(raw || "{}") : Object.fromEntries(new URLSearchParams(raw)); } catch (e) { req.body = {}; }
      api(req, res);
    });
    return;
  }
  const file = path.join(__dirname, u.pathname === "/" ? "index.html" : path.normalize(u.pathname).replace(/^(\.\.[\/\\])+/, ""));
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
