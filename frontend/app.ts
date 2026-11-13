const button = document.querySelector<HTMLButtonElement>("#run");
const output = document.querySelector<HTMLElement>("#output");

button?.addEventListener("click", async () => {
  if (!output) return;
  output.textContent = "Running...";
  try {
    const response = await fetch("http://127.0.0.1:8080/api/v1/simulate");
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data: unknown = await response.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    output.textContent = error instanceof Error ? error.message : "Request failed";
  }
});
