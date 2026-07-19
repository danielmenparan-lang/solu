export async function loader() {
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export default function HealthCheck() {
  return null;
}
