export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }
    try {
      const formData = await request.formData();
      const submission = {
        name: formData.get("name")?.trim(),
        fishCount: parseInt(formData.get("fishCount")),
        fish: [],
      };
      if (!submission.name) {
        return new Response(
          JSON.stringify({ success: false, error: "Angler name is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (!submission.fishCount || submission.fishCount < 1 || submission.fishCount > 5) {
        return new Response(
          JSON.stringify({ success: false, error: "Fish count must be between 1 and 5" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      for (let i = 1; i <= submission.fishCount; i++) {
        const photo = formData.get(`fishPhoto${i}`);
        const length = formData.get(`fishLength${i}`);
        if (!photo || !length) {
          return new Response(
            JSON.stringify({ success: false, error: `Missing photo or length for fish ${i}` }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        const photoBuffer = await photo.arrayBuffer();
        const photoBase64 = Buffer.from(photoBuffer).toString("base64");
        submission.fish.push({
          photo: { name: photo.name, size: photo.size, type: photo.type, data: photoBase64 },
          length: parseFloat(length),
        });
      }
      const key = `submission_${submission.name}_${Date.now()}`;
      await env.KV.put(key, JSON.stringify(submission));
      const allKeys = await env.KV.list();
      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully stored submission for ${submission.name}`,
          submissionId: key,
          allKeys: allKeys.keys.map(k => k.name),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
