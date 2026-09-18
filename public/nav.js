// Shared site navigation.
// Put <script src="nav.js"></script> where the navbar should appear on a page.
// The markup is inserted synchronously at the script tag, so the nav is in the
// DOM before the page renders and before window_events.js looks for it.
document.currentScript.insertAdjacentHTML('afterend', `
<nav class="navbar navbar-expand-lg navbar-light sticky-top">
  <div class="container-fluid">
    <button class="navbar-toggler order-1" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <!-- LOGO -->
    <a href="/" class="navbar-brand order-2" style="text-decoration: none;">
      <img id="nav-brand-logo" src="./images/website_logo.png" alt="My Website Logo">
    </a>
    <div class="collapse navbar-collapse order-3" id="navbarNav">
      <ul class="navbar-nav ms-auto">
        <li class="nav-item">
          <a class="nav-link" href="/">Home</a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="/ramble">Ramble</a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="/about">About</a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="/zine">Zine</a>
        </li>
      </ul>
    </div>
  </div>
</nav>
`);
