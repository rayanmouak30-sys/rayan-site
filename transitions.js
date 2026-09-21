(function () {
    var veil = document.getElementById("veil");
    if (!veil) return;

    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            veil.classList.add("veil-open");
        });
    });

    document.addEventListener("click", function (e) {
        var link = e.target.closest("a[href]");
        if (!link) return;
        var href = link.getAttribute("href");
        if (
            !href ||
            href.charAt(0) === "#" ||
            link.target === "_blank" ||
            href.indexOf("http") === 0 ||
            href.indexOf("mailto:") === 0 ||
            href.indexOf("tel:") === 0
        ) {
            return;
        }
        e.preventDefault();
        veil.classList.remove("veil-open");
        veil.classList.add("veil-close");
        setTimeout(function () {
            window.location.href = href;
        }, 480);
    });

    window.addEventListener("pageshow", function (e) {
        if (e.persisted) {
            veil.classList.remove("veil-close");
            veil.classList.add("veil-open");
        }
    });
})();
