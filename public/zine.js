// Zine photo slideshow (dots, click-to-advance, swipe).
let slideIndex = 1;
showSlides(slideIndex);

function showSlides(n) {
  let slides = document.getElementsByClassName("mySlides");
  let dots = document.getElementsByClassName("dot");

  if (n > slides.length) { slideIndex = 1; }
  if (n < 1) { slideIndex = slides.length; }

  // Remove active class from all dots
  for (let i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }
  dots[slideIndex - 1].className += " active";

  // Slide the track so the current slide is the one in view, instead of
  // fading slides in and out.
  document.querySelector(".slides-track").style.transform =
    `translateX(${-(slideIndex - 1) * 100}%)`;
}

// Go to the next slide
function nextSlide() {
  showSlides(++slideIndex);
}

// Go to the previous slide
function prevSlide() {
  showSlides(--slideIndex);
}

// Go to a specific slide (used by the dots)
function currentSlide(n) {
  showSlides(slideIndex = n);
}

// Click a slide to advance to the next one
document.querySelectorAll(".mySlides").forEach(slide => {
  slide.addEventListener("click", nextSlide);
});

// Dots jump straight to their slide
document.querySelectorAll(".dot").forEach((dot, i) => {
  dot.addEventListener("click", () => currentSlide(i + 1));
});

// Swipe detection for mobile
let startX = 0;
let endX = 0;

document.querySelector(".slideshow-container").addEventListener("touchstart", (e) => {
  startX = e.touches[0].clientX;
});

document.querySelector(".slideshow-container").addEventListener("touchend", (e) => {
  endX = e.changedTouches[0].clientX;
  if (startX > endX + 50) { // Swipe left → next slide
    nextSlide();
  } else if (startX < endX - 50) { // Swipe right → previous slide
    prevSlide();
  }
});
