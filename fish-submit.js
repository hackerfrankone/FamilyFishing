let cachedAccessToken = null;
let TOKEN_EXPIRY = 0;

async function getDropboxAccessToken(env) {
  if (cachedAccessToken && Date.now() < TOKEN_EXPIRY) {
    return cachedAccessToken;
  }

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${env.DROPBOX_CLIENT_ID}:${env.DROPBOX_CLIENT_SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.DROPBOX_REFRESH_TOKEN,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Dropbox access token: ${errorText}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  TOKEN_EXPIRY = Date.now() + (data.expires_in * 1000 - 60000);
  return cachedAccessToken;
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://www.familyfishing.fun",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.pathname === "/angler_list") {
        try {
          const csvUrl = "https://raw.githubusercontent.com/hackerfrankone/FamilyFishing/main/CSV/angler_list.csv";
          const response = await fetch(csvUrl, {
            headers: { Accept: "text/csv" },
          });

          if (!response.ok) {
            return new Response(`Error fetching CSV: ${response.statusText}`, {
              status: response.status,
              headers: { "Content-Type": "text/plain", ...corsHeaders },
            });
          }

          const csvText = await response.text();
          return new Response(csvText, {
            status: 200,
            headers: { "Content-Type": "text/csv", ...corsHeaders },
          });
        } catch (error) {
          console.error("Failed to fetch angler list:", error.message);
          return new Response(`Server error: ${error.message}`, {
            status: 500,
            headers: { "Content-Type": "text/plain", ...corsHeaders },
          });
        }
      }

      if (url.pathname === "/images") {
        try {
          const name = url.searchParams.get("name")?.trim();
          if (!name) {
            return new Response(JSON.stringify({ error: "Missing angler name" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }

          const csvUrl = "https://raw.githubusercontent.com/hackerfrankone/FamilyFishing/main/CSV/angler_list.csv";
          const csvResponse = await fetch(csvUrl, { headers: { Accept: "text/csv" } });
          if (!csvResponse.ok) {
            throw new Error(`Failed to fetch angler list: ${csvResponse.statusText}`);
          }
          const csvText = await csvResponse.text();
          const anglers = csvText.split("\n").slice(1).map(line => line.split(",")[0].trim()).filter(name => name);
          if (!anglers.includes(name)) {
            return new Response(JSON.stringify({ error: `Angler "${name}" is not registered` }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }

          const accessToken = await getDropboxAccessToken(env);
          const folderPath = `/FamilyFishingImages/${name}`;
          let images = [];
          let cursor = null;
          let hasMore = true;

          while (hasMore) {
            const listResponse = await fetch("https://api.dropboxapi.com/2/files/list_folder" + (cursor ? "/continue" : ""), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(cursor ? { cursor } : { path: folderPath, include_media_info: true }),
            });

            if (!listResponse.ok) {
              const errorText = await listResponse.text();
              throw new Error(`Failed to list folder: ${errorText}`);
            }

            const listData = await listResponse.json();
            const entries = listData.entries.filter(entry => entry[".tag"] === "file");

            for (const entry of entries) {
              const linkResponse = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  path: entry.path_display,
                  settings: { requested_visibility: "public" },
                }),
              });

              let imageUrl = "";
              if (linkResponse.ok) {
                const linkData = await linkResponse.json();
                imageUrl = linkData.url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
              } else {
                console.warn(`Failed to create shared link for ${entry.name}: ${await linkResponse.text()}`);
                continue;
              }

              images.push({
                name: entry.name,
                url: imageUrl,
                size: entry.size,
                uploaded: entry.server_modified,
              });
            }

            hasMore = listData.has_more;
            cursor = listData.cursor;
          }

          return new Response(JSON.stringify(images), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (error) {
          console.error("Failed to fetch images:", error.message);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (request.method === "POST") {
      try {
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("multipart/form-data")) {
          return new Response(JSON.stringify({ error: "Expected multipart/form-data" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const formData = await request.formData();
        const angler = formData.get("name")?.trim();
        const fishCount = parseInt(formData.get("fishCount"));

        if (!angler || !fishCount || fishCount < 1 || fishCount > 5) {
          return new Response(JSON.stringify({ error: "Missing or invalid form data" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const csvUrl = "https://raw.githubusercontent.com/hackerfrankone/FamilyFishing/main/CSV/angler_list.csv";
        const csvResponse = await fetch(csvUrl, { headers: { Accept: "text/csv" } });
        if (!csvResponse.ok) {
          throw new Error(`Failed to fetch angler list: ${csvResponse.statusText}`);
        }
        const csvText = await csvResponse.text();
        const anglers = csvText.split("\n").slice(1).map(line => line.split(",")[0].trim()).filter(name => name);
        if (!anglers.includes(angler)) {
          return new Response(JSON.stringify({ error: `Angler "${angler}" is not registered` }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const accessToken = await getDropboxAccessToken(env);
        const uploaded = [];

        for (let i = 1; i <= fishCount; i++) {
          const file = formData.get(`fishPhoto${i}`);
          const length = formData.get(`fishLength${i}`);

          if (!(file instanceof File) || !length || isNaN(parseFloat(length)) || parseFloat(length) <= 0) {
            continue;
          }

          const arrayBuffer = await file.arrayBuffer();
          const fileName = `fish-${Date.now()}-${i}-${file.name}`;
          const dropboxPath = `/FamilyFishingImages/${angler}/${fileName}`;

          const uploadResponse = await fetch("https://content.dropboxapi.com/2/files/upload", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/octet-stream",
              "Dropbox-API-Arg": JSON.stringify({
                path: dropboxPath,
                mode: "add",
                autorename: true,
                mute: false,
              }),
            },
            body: arrayBuffer,
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed for ${fileName}: ${errorText}`);
          }

          const linkResponse = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              path: dropboxPath,
              settings: { requested_visibility: "public" },
            }),
          });

          let imageUrl = "";
          if (linkResponse.ok) {
            const linkData = await linkResponse.json();
            imageUrl = linkData.url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
          } else {
            console.warn(`Failed to create shared link for ${fileName}: ${await linkResponse.text()}`);
          }

          uploaded.push({ imageUrl, length: parseFloat(length) });
        }

        return new Response(JSON.stringify({ message: "Upload successful", uploaded }, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error) {
        console.error("Upload error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  },
};
