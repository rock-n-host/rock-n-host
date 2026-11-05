// Repeat the signal trace across the poster using the original curve as a guide.
const waves = document.getElementById("waves");
if (waves) {
  const trace = waves.querySelector("path");
  for (let offset = -6; offset <= 6; offset += 1) {
    if (offset === 0) continue;
    const echo = trace.cloneNode();
    echo.setAttribute("transform", `translate(0 ${offset * 5})`);
    waves.append(echo);
  }
}

const root = document.documentElement;
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(pointer: fine)");
const motionToggle = document.querySelector(".motion-toggle");
const sections = document.querySelectorAll(".section");
let paused = false;
try {
  paused = sessionStorage.getItem("motion-paused") === "true";
} catch {
  // The motion control also works when browser storage is unavailable.
}
let pointerFrame = 0;
let observer;

function syncMotion() {
  const disabled = paused || motionPreference.matches;
  root.dataset.motion = disabled ? "off" : "on";
  motionToggle.textContent = motionPreference.matches ? "Reduced motion enabled" : paused ? "Resume motion" : "Pause motion";
  motionToggle.setAttribute("aria-pressed", String(disabled));
  motionToggle.disabled = motionPreference.matches;
  if (disabled) {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    root.classList.remove("cursor-active");
    document.querySelectorAll(".note-active").forEach(card => card.classList.remove("note-active"));
    sections.forEach(section => section.classList.add("visible"));
    observer?.disconnect();
  }
}
motionToggle.hidden = false;
motionToggle.addEventListener("click", () => {
  paused = !paused;
  try {
    sessionStorage.setItem("motion-paused", String(paused));
  } catch {
    // Keep the preference for this page when storage is unavailable.
  }
  syncMotion();
});
motionPreference.addEventListener("change", syncMotion);
syncMotion();

if (root.dataset.motion !== "off" && "IntersectionObserver" in window) {
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  sections.forEach(section => {
    section.classList.add("reveal");
    observer.observe(section);
  });
}

document.addEventListener("pointermove", event => {
  if (root.dataset.motion === "off" || !finePointer.matches) return;
  if (pointerFrame) return;
  pointerFrame = requestAnimationFrame(() => {
    root.style.setProperty("--cursor-x", event.clientX + "px");
    root.style.setProperty("--cursor-y", event.clientY + "px");
    root.classList.add("cursor-active");
    pointerFrame = 0;
  });
}, { passive: true });
document.documentElement.addEventListener("pointerleave", () => root.classList.remove("cursor-active"));

const projectCards = document.querySelectorAll(".card");
projectCards.forEach(card => {
  const playNote = () => {
    if (root.dataset.motion === "off" || card.classList.contains("note-active")) return;
    projectCards.forEach(other => other.classList.remove("note-active"));
    card.classList.add("note-active");
  };
  card.addEventListener("pointerenter", playNote);
  card.addEventListener("focusin", playNote);
  card.addEventListener("pointerleave", () => card.classList.remove("note-active"));
  card.addEventListener("focusout", () => card.classList.remove("note-active"));
  card.querySelector(".project-note").addEventListener("animationend", () => card.classList.remove("note-active"));
});

function startBoot() {
  const screen = document.getElementById("boot-screen");
  if (!screen || root.dataset.motion === "off" || typeof screen.showModal !== "function") return;
  try {
    if (sessionStorage.getItem("boot-seen") === "true") return;
  } catch {
    // Without storage, play the introduction on each homepage visit.
  }

  let finishTimer;
  let closeTimer;
  const closeBoot = () => {
    clearTimeout(finishTimer);
    clearTimeout(closeTimer);
    screen.close();
    root.classList.remove("booting");
    motionPreference.removeEventListener("change", handleMotionChange);
    try {
      sessionStorage.setItem("boot-seen", "true");
    } catch {
      // Closing the intro does not require browser storage.
    }
  };
  const handleMotionChange = () => {
    if (motionPreference.matches) closeBoot();
  };
  screen.querySelector("#skip-boot").addEventListener("click", closeBoot, { once: true });
  screen.addEventListener("cancel", event => {
    event.preventDefault();
    closeBoot();
  }, { once: true });
  motionPreference.addEventListener("change", handleMotionChange);
  root.classList.add("booting");
  screen.showModal();
  finishTimer = setTimeout(() => {
    screen.classList.add("boot-finished");
    closeTimer = setTimeout(closeBoot, 650);
  }, 2600);
}

startBoot();
