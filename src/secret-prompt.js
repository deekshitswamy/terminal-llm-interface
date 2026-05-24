export async function promptSecret(promptText) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const wasRaw = Boolean(stdin.isRaw);
    let value = "";

    function cleanup() {
      stdin.removeListener("data", onData);
      if (stdin.isTTY) {
        stdin.setRawMode(wasRaw);
      }
      stdin.pause();
      stdout.write("\n");
    }

    function onData(buffer) {
      const chunk = buffer.toString("utf8");

      if (chunk === "\u0003") {
        cleanup();
        resolve("");
        return;
      }

      if (chunk === "\r" || chunk === "\n") {
        cleanup();
        resolve(value);
        return;
      }

      if (chunk === "\u007f") {
        if (value.length > 0) {
          value = value.slice(0, -1);
        }
        return;
      }

      if (/[\u0000-\u001f]/u.test(chunk)) {
        return;
      }

      value += chunk;
    }

    stdout.write(promptText);
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.on("data", onData);
  });
}
