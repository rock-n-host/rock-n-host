function initializeTerminal() {
  // Start the shell before loading content so a failed request cannot disable it.
  let projects = [];
  let projectsLoaded = false;
  let loading = false;
  const unavailable = "Content is unavailable. Serve the site over HTTP, then type reload.";
  const files = {
    "/about.txt": unavailable,
    "/notes.txt": unavailable,
    "/projects": null
  };
  const destinations = {
    home: "../index.html",
    projects: "./projects.html",
    about: "./about.html",
    notes: "../index.html#notes",
    terminal: "./terminal.html",
    github: "https://github.com/rock-n-host"
  };

  const terminalForm = document.getElementById("terminal-form");
  const terminalInput = document.getElementById("terminal-input");
  const terminalLog = document.getElementById("terminal-log");
  const terminalPath = document.getElementById("terminal-path");
  let directory = "/";
  const history = [];
  let historyIndex = 0;
  let draft = "";

  function print(text, className = "", link) {
    const entry = document.createElement("div");
    entry.className = "terminal-entry " + className;
    entry.textContent = text;
    if (link) {
      const anchor = document.createElement("a");
      anchor.href = link;
      anchor.textContent = "Open ↗";
      entry.append(document.createTextNode("\n"), anchor);
    }
    terminalLog.append(entry);
    // Bound the session's DOM size during long visits.
    if (terminalLog.childElementCount > 100) terminalLog.firstElementChild.remove();
    terminalLog.scrollTop = terminalLog.scrollHeight;
  }

  async function loadContent() {
    if (loading) return print("Page content is still loading.");
    if (location.protocol === "file:") {
      print("Local file mode: your browser blocks reading neighboring HTML files.\nFrom the project folder, run:\n  python -m http.server 8000\nThen open the terminal through the local server.\nhelp, fetch, and navigation links remain available.", "terminal-error", "http://localhost:8000/sites/terminal.html");
      return;
    }
    loading = true;
    const paths = ["./projects.html", "./about.html", "../index.html"];
    const results = await Promise.allSettled(paths.map(async path => {
      const response = await fetch(path, { cache: "no-cache", signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const page = new DOMParser().parseFromString(await response.text(), "text/html");
      if (path === "./projects.html") {
        const cards = [...page.querySelectorAll(".card")];
        if (!page.querySelector("#projects")) throw new Error("Projects section is missing");
        const updatedProjects = cards.map(card => ({
          name: card.querySelector("h3").textContent,
          description: card.querySelector("p").textContent,
          url: new URL(card.getAttribute("href"), response.url).href
        }));
        projects.forEach(project => {
          delete files["/projects/" + project.name + ".txt"];
          delete destinations[project.name];
        });
        projects = updatedProjects;
        projects.forEach(project => {
          files["/projects/" + project.name + ".txt"] = project.description + "\n" + project.url;
          destinations[project.name] = project.url;
        });
        projectsLoaded = true;
      } else {
        const selector = path === "./about.html" ? "#about p" : "#notes p";
        const content = page.querySelector(selector);
        if (!content) throw new Error("Expected page content is missing");
        files[path === "./about.html" ? "/about.txt" : "/notes.txt"] = content.textContent;
      }
    }));
    loading = false;
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        print("Could not load " + paths[index] + ": " + result.reason.message + ". Type reload to retry.", "terminal-error");
      }
    });
    if (results.every(result => result.status === "fulfilled")) print("Page content loaded. Try ls or cat about.txt.");
  }

  function resolvePath(value = ".") {
    const path = value.replace(/^~(?=\/|$)/, "");
    const parts = (value.startsWith("~") || path.startsWith("/") ? path : directory + "/" + path).split("/");
    const result = [];
    parts.forEach(part => {
      if (part === "..") result.pop();
      else if (part && part !== ".") result.push(part);
    });
    return "/" + result.join("/");
  }

  const commands = {
    help() {
      print("Explore\n  ls [path]          List files\n  cd [directory]     Change directory (try projects)\n  cat <file>         Read a file\n  open <name>        Get a page or project link\n\nSystem\n  fetch / neofetch   Show this site's system card\n  pwd               Current directory\n  whoami            Your local identity\n  date              Your local date and time\n  echo <text>       Print something\n  clear             Clear the terminal\n  reload            Reload content from the pages\n\nUse ↑ ↓ for command history and Tab to complete.\nThis is a browser-local shell with a virtual filesystem.");
    },
    ls(argument) {
      const path = resolvePath(argument || ".");
      if (path === "/projects" && !projectsLoaded) return print(loading ? "Projects are loading." : unavailable, "terminal-error");
      if (path !== "/" && !(path in files)) return print("ls: path not found", "terminal-error");
      if (files[path] != null) return print(path.split("/").pop());
      const prefix = path === "/" ? "/" : path + "/";
      const children = Object.keys(files).filter(file => file.startsWith(prefix) && !file.slice(prefix.length).includes("/"));
      print(children.map(file => file.slice(prefix.length) + (files[file] === null ? "/" : "")).join("  "));
    },
    cd(argument) {
      const path = resolvePath(argument || "/");
      if (path !== "/" && files[path] !== null) return print("cd: directory not found", "terminal-error");
      directory = path;
      terminalPath.textContent = " ~" + (directory === "/" ? "" : directory) + " ";
    },
    cat(argument) {
      if (loading) return print("Page content is loading. Try again in a moment.");
      const path = resolvePath(argument);
      if (!argument || typeof files[path] !== "string") return print("cat: choose a file listed by ls", "terminal-error");
      print(files[path]);
    },
    open(argument) {
      const name = argument.replace(/\.txt$/, "").split("/").pop();
      if (!destinations[name]) return print("Try open " + Object.keys(destinations).join(", "), "terminal-error");
      print(name, "", destinations[name]);
    },
    fetch() {
      print("  /\\   R N H\n /__\\  ─────────────────────────\n |  |  guest@rock-n-host\n\nHost      rock-n-host portfolio\nShell     rnh-shell 1.0 (simulated)\nRuntime   Your browser\nStack     HTML · CSS · JavaScript\nProjects  " + (projectsLoaded ? projects.length : "Unavailable") + "\nViewport  " + innerWidth + " × " + innerHeight + "\nMotion    " + (document.documentElement.dataset.motion === "off" ? "Reduced / paused" : "Enabled") + "\nTheme     After hours / orange signal");
    },
    pwd() { print("/home/guest" + (directory === "/" ? "" : directory)); },
    whoami() { print("guest — welcome to rock-n-host's corner of the internet."); },
    date() { print(new Date().toLocaleString()); },
    echo(argument) { print(argument); },
    clear() { terminalLog.replaceChildren(); }
  };
  commands.reload = loadContent;
  commands.neofetch = commands.fetch;

  function runCommand(value) {
    const commandLine = value.trim();
    if (!commandLine) return;
    print("guest@rnh:~" + (directory === "/" ? "" : directory) + " ❯ " + commandLine, "terminal-command");
    history.push(commandLine);
    if (history.length > 100) history.shift();
    historyIndex = history.length;
    draft = "";
    const [name] = commandLine.split(/\s+/);
    const argument = commandLine.slice(name.length).trim();
    if (Object.hasOwn(commands, name)) commands[name](argument);
    else print(name + ": command not found. Type help to see the commands.", "terminal-error");
    terminalInput.value = "";
  }
  terminalForm.addEventListener("submit", event => {
    event.preventDefault();
    runCommand(terminalInput.value);
  });
  document.querySelectorAll("[data-command]").forEach(button => {
    button.addEventListener("click", () => {
      runCommand(button.dataset.command);
      terminalInput.focus({ preventScroll: true });
    });
  });
  terminalInput.addEventListener("keydown", event => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === history.length) draft = terminalInput.value;
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === "ArrowUp" ? -1 : 1)));
      terminalInput.value = historyIndex === history.length ? draft : history[historyIndex];
    }
    if (event.key === "Tab" && !event.shiftKey) {
      const value = terminalInput.value.trimStart();
      const words = value.split(/\s+/);
      const prefix = words.pop();
      let candidates = Object.keys(commands);
      if (words.length) {
        const parent = prefix.includes("/") ? prefix.slice(0, prefix.lastIndexOf("/") + 1) : "";
        const base = resolvePath(parent || ".");
        const pathPrefix = base === "/" ? "/" : base + "/";
        candidates = Object.keys(files)
          .filter(file => file.startsWith(pathPrefix) && !file.slice(pathPrefix.length).includes("/"))
          .filter(file => words[0] !== "cd" || files[file] === null)
          .map(file => parent + file.slice(pathPrefix.length) + (files[file] === null ? "/" : ""));
        if (words[0] === "open") candidates = Object.keys(destinations);
      }
      const matches = candidates.filter(candidate => candidate.startsWith(prefix));
      if (matches.length) {
        event.preventDefault();
        if (matches.length === 1) terminalInput.value = [...words, matches[0]].join(" ");
        else print(matches.join("  "));
      }
    }
  });
  document.querySelectorAll("#terminal button, #terminal input").forEach(control => { control.disabled = false; });
  loadContent();
}

initializeTerminal();
