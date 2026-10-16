import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
let url = "", secret = "";
for (const line of env.split("\n")) {
  if (line.includes("NEXT_PUBLIC_SUPABASE_URL=")) url = line.split("=")[1].replace(/["'\r]/g, "").trim();
  if (line.includes("SUPABASE_SECRET_KEY=")) secret = line.split("=")[1].replace(/["'\r]/g, "").trim();
}

async function testSql() {
  // Try api.supabase.com with project ref
  const projRef = url.replace("https://", "").replace(".supabase.co", "");
  console.log("Project ref:", projRef);

  const endpoints = [
    `https://api.supabase.com/v1/projects/${projRef}/database/query`,
    `https://${projRef}.supabase.co/rest/v1/rpc/exec`,
    `https://${projRef}.supabase.co/rest/v1/rpc/execute`,
    `https://${projRef}.supabase.co/pg/query`,
    `https://${projRef}.supabase.co/sql`
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: {
          "apikey": secret,
          "Authorization": `Bearer ${secret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: "SELECT 1" })
      });
      console.log(ep, res.status, await res.text().catch(e => "err text"));
    } catch (e) {
      console.log(ep, "fetch failed:", e.message);
    }
  }
}

testSql().catch(console.error);
