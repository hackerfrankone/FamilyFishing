async function parseRequest(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return {};
    }
    const formData = await request.formData();
    const obj = {};
    for (const [key, value] of formData.entries()) {
      obj[key] = value instanceof File ? value : value.toString();
    }
    return obj;
  } catch (err) {
    console.error("Error parsing request:", err.message);
    return {};
  }
}

async function fetchAnglerList() {
  try {
    const res = await fetch(process.env.CSV_URL);
    if (!res.ok) throw new Error(`Failed to fetch angler list: HTTP ${res.status}`);
    const csvText = await res.text();
    if (!csvText.trim()) throw new Error("Empty CSV");
    return csvText.trim().split("\n").slice(1).map(line => line.split(",")[0].trim());
  } catch (err) {
    console.error("Error fetching angler list:", err.message);
    throw err;
  }
}

async function uploadImageToCloudflare(file) {
  try {
    const formData = new FormData();
    formData.append("file", file, file.name);
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/images/v1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}` },
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.errors?.[0]?.message || "Image upload failed");
    return json.result.id;
  } catch (err) {
    console.error("Error uploading image:", err.message);
    throw err;
  }
}

async function validateImageUrl(imageUrl) {
  try {
    const res = await fetch(imageUrl, { method: "HEAD" });
    return res.ok;
  } catch (err) {
    console.error(`Error validating image URL ${imageUrl}:`, err.message);
    return false;
  }
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-cache",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/") {
      try {
        const data = await parseRequest(request);
        const name = data.name?.trim();
        if (!name) {
          return new Response(JSON.stringify({ error: "Missing angler name" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const anglers = await fetchAnglerList();
        if (!anglers.includes(name)) {
          return new Response(JSON.stringify({ error: `Angler name "${name}" not found in registration` }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const fishCount = parseInt(data.fishCount);
        if (!fishCount || fishCount < 1 || fishCount > 5) {
          return new Response(JSON.stringify({ error: "Invalid fish count (must be 1-5)" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const existingData = (await env.KV.get(`images_${name}`)) ? JSON.parse(await env.KV.get(`images_${name}`)) : [];
        if (existingData.length + fishCount > 5) {
          return new Response(JSON.stringify({ error: `Cannot upload ${fishCount} more images. Maximum 5 images per angler.` }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const uploadedImages = [];
        for (let i = 1; i <= fishCount; i++) {
          const file = data[`fishPhoto${i}`];
          const length = data[`fishLength${i}`];
          if (!file || !file.name) {
            return new Response(JSON.stringify({ error: `Missing file for fish ${i}` }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
          if (!length || Number(length) <= 0) {
            return new Response(JSON.stringify({ error: `Invalid length for fish ${i}` }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
          const imageId = await uploadImageToCloudflare(file);
          const imageUrl = `https://imagedelivery.net/${process.env.CF_IMAGE_NAMESPACE}/${imageId}/public`;
          uploadedImages.push({ url: imageUrl, length });
        }

        const newData = [...existingData, ...uploadedImages].slice(0, 5);
        await env.KV.put(`images_${name}`, JSON.stringify(newData));
        return new Response(
          JSON.stringify({
            success: true,
            message: `Successfully uploaded ${fishCount} fish image(s)`,
            images: uploadedImages,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    if (request.method === "GET" && url.pathname === "/images") {
      try {
        const name = url.searchParams.get("name")?.trim();
        if (!name) {
          return new Response(JSON.stringify({ error: "Missing angler name" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        const images = (await env.KV.get(`images_${name}`)) ? JSON.parse(await env.KV.get(`images_${name}`)) : [];
        const validImages = [];
        for (const img of images) {
          if (await validateImageUrl(img.url)) {
            validImages.push(img);
          }
        }
        await env.KV.put(`images_${name}`, JSON.stringify(validImages));
        return new Response(JSON.stringify({ images: validImages }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
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
