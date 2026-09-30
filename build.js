// Generates the public/*.html pages from views/*.html templates, substituting
// the shared <!--#include head--> marker with views/partials/head.html. This
// keeps the <head> boilerplate (font links, Bootstrap tags, meta tags) that's
// identical across every page in one place, instead of copy-pasted into each
// page's own HTML file.
//
// Run manually with `npm run build` after editing anything under views/.
// Also runs automatically after `npm install` (see package.json's
// "postinstall" script), so a Heroku deploy always regenerates public/*.html
// from the current templates.
const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, 'views');
const PUBLIC_DIR = path.join(__dirname, 'public');
const INCLUDE_RE = /<!--#include (\w+)-->/g;

function build() {
    const partials = {};
    const partialsDir = path.join(VIEWS_DIR, 'partials');
    for (const file of fs.readdirSync(partialsDir)) {
        partials[path.basename(file, '.html')] = fs.readFileSync(path.join(partialsDir, file), 'utf8');
    }

    const pages = fs.readdirSync(VIEWS_DIR).filter((f) => f.endsWith('.html'));
    for (const page of pages) {
        const template = fs.readFileSync(path.join(VIEWS_DIR, page), 'utf8');
        const rendered = template.replace(INCLUDE_RE, (match, name) => {
            if (!(name in partials)) throw new Error(`${page}: unknown partial "${name}"`);
            return partials[name];
        });
        fs.writeFileSync(path.join(PUBLIC_DIR, page), rendered);
        console.log(`built public/${page}`);
    }
}

build();
