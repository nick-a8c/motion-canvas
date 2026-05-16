import * as RiveModule from '@rive-app/canvas';
import lottie from 'lottie-web';

const RiveClass = RiveModule.Rive || RiveModule.default || RiveModule;

const pendingAudioUnlock = new Set();
let audioListenerAttached = false;

function registerForAudioUnlock( riveInstance ) {
    pendingAudioUnlock.add( riveInstance );
    if ( audioListenerAttached ) return;
    audioListenerAttached = true;

    const unlockAll = () => {
        pendingAudioUnlock.forEach( ( r ) => {
            try {
                r.initializeAudio();
            } catch ( e ) {}
        } );
        pendingAudioUnlock.clear();
        document.removeEventListener( 'click', unlockAll );
        document.removeEventListener( 'touchstart', unlockAll );
    };

    document.addEventListener( 'click', unlockAll );
    document.addEventListener( 'touchstart', unlockAll );
}

// Build a friendly fallback overlay for any animation type. The heading
// is the same across formats; the hint differs per format because the
// remediation differs (Spline = wrong URL, Rive/Lottie/HTML = bad file).
function buildFallbackOverlay( hintHTML ) {
    const overlay = document.createElement( 'div' );
    overlay.className = 'mb-fallback-overlay';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.background = '#1a1a2e';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '20px';
    overlay.style.textAlign = 'center';
    overlay.style.zIndex = '2';

    const heading = document.createElement( 'p' );
    heading.style.color = '#ccccdd';
    heading.style.fontSize = '15px';
    heading.style.lineHeight = '1.5';
    heading.style.margin = '0 0 12px 0';
    heading.innerHTML = 'Whoops!<br>The animation seems to not be working.<br>:/';
    overlay.appendChild( heading );

    const hint = document.createElement( 'p' );
    hint.style.color = '#8888aa';
    hint.style.fontSize = '13px';
    hint.style.margin = '0';
    hint.innerHTML = hintHTML;
    overlay.appendChild( hint );

    return overlay;
}

const SPLINE_HINT = 'Please check if the <strong style="color:#ccccdd">URL</strong> from Spline is <strong style="color:#ccccdd">correct</strong>.';
const RIVE_HINT = 'Make sure the file is a valid <strong style="color:#ccccdd">.riv</strong> export from Rive.';
const LOTTIE_HINT = 'Make sure the file is a valid <strong style="color:#ccccdd">Lottie JSON</strong> export.';
const HTML_HINT = 'Make sure the uploaded <strong style="color:#ccccdd">.html</strong> file is self-contained.';

function showFallback( wrapper, hintHTML ) {
    if ( wrapper.querySelector( '.mb-fallback-overlay' ) ) return;
    const overlay = buildFallbackOverlay( hintHTML );
    wrapper.appendChild( overlay );
}

function mountSplineIframe( wrapper, splineUrl ) {
    wrapper.innerHTML = '';

    const iframe = document.createElement( 'iframe' );
    iframe.src = splineUrl;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.border = 'none';
    iframe.allow = 'autoplay';
    wrapper.appendChild( iframe );

    let loaded = false;

    iframe.addEventListener( 'load', () => {
        loaded = true;
    } );

    iframe.addEventListener( 'error', () => {
        showFallback( wrapper, SPLINE_HINT );
    } );

    setTimeout( () => {
        if ( ! loaded ) showFallback( wrapper, SPLINE_HINT );
    }, 8000 );
}

// Mount an uploaded HTML file inside a sandboxed iframe. The sandbox
// attribute is set to 'allow-scripts' only — the iframe can run JS
// (so Three.js etc. work), but cannot access the parent page's DOM,
// cookies, storage, or navigate the top frame. This matches the
// security posture WordPress uses for Custom HTML blocks.
function mountHtmlIframe( wrapper, fileUrl ) {
    wrapper.innerHTML = '';

    const iframe = document.createElement( 'iframe' );
    iframe.src = fileUrl;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.border = 'none';
    iframe.setAttribute( 'sandbox', 'allow-scripts' );
    iframe.setAttribute( 'loading', 'lazy' );
    wrapper.appendChild( iframe );

    let loaded = false;

    iframe.addEventListener( 'load', () => {
        loaded = true;
    } );

    iframe.addEventListener( 'error', () => {
        showFallback( wrapper, HTML_HINT );
    } );

    setTimeout( () => {
        if ( ! loaded ) showFallback( wrapper, HTML_HINT );
    }, 8000 );
}

document.querySelectorAll( '.wp-block-motion-blocks-motion' ).forEach( ( block ) => {    const fileUrl = block.dataset.fileUrl;
    const animationType = block.dataset.animationType;
    const aspectRatioAttr = block.dataset.aspectRatio;

    if ( ! fileUrl && ! block.dataset.splineUrl ) return;

    const wrapper = document.createElement( 'div' );
    wrapper.className = 'mb-canvas-wrapper';
    wrapper.style.width = '100%';
    wrapper.style.position = 'relative';
    wrapper.style.aspectRatio = aspectRatioAttr || '16 / 9';
    block.appendChild( wrapper );

    if ( animationType === 'rive' ) {
        const canvas = document.createElement( 'canvas' );
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        wrapper.appendChild( canvas );

        const r = new RiveClass( {
            src: fileUrl,
            canvas,
            autoplay: true,
            onLoad: () => {
                if ( ! aspectRatioAttr && r.bounds ) {
                    const b = r.bounds;
                    const w = b.maxX - b.minX;
                    const h = b.maxY - b.minY;
                    if ( w > 0 && h > 0 ) {
                        wrapper.style.aspectRatio = `${ w } / ${ h }`;
                    }
                }

                const machines = r.stateMachineNames;
                if ( machines && machines.length > 0 ) {
                    r.stop();
                    r.play( machines[ 0 ] );
                }

                r.resizeDrawingSurfaceToCanvas();
                registerForAudioUnlock( r );

                let rafId = null;
                const ro = new ResizeObserver( () => {
                    if ( rafId ) cancelAnimationFrame( rafId );
                    rafId = requestAnimationFrame( () => {
                        r.resizeDrawingSurfaceToCanvas();
                        rafId = null;
                    } );
                } );
                ro.observe( wrapper );

                window.addEventListener( 'resize', () => {
                    r.resizeDrawingSurfaceToCanvas();
                } );
            },
            onLoadError: () => {
                showFallback( wrapper, RIVE_HINT );
            },
        } );
    }

    if ( animationType === 'spline' ) {
        const splineUrl = block.dataset.splineUrl;
        if ( ! splineUrl ) return;

        mountSplineIframe( wrapper, splineUrl );
    }

    if ( animationType === 'html' ) {
        if ( ! fileUrl ) return;
        mountHtmlIframe( wrapper, fileUrl );
    }

    if ( animationType === 'lottie' ) {
        const lottieContainer = document.createElement( 'div' );
        lottieContainer.style.width = '100%';
        lottieContainer.style.height = '100%';
        wrapper.appendChild( lottieContainer );

        const loop = block.dataset.loop !== '0';
        const autoplay = block.dataset.autoplay !== '0';
        const playbackSpeed = parseFloat( block.dataset.playbackSpeed ) || 1;
        const trigger = block.dataset.trigger || 'autoplay';

        const shouldAutoplayOnLoad = autoplay && trigger === 'autoplay';

        const anim = lottie.loadAnimation( {
            container: lottieContainer,
            renderer: 'svg',
            loop,
            autoplay: shouldAutoplayOnLoad,
            path: fileUrl,
        } );

        anim.setSpeed( playbackSpeed );

        anim.addEventListener( 'data_failed', () => {
            showFallback( wrapper, LOTTIE_HINT );
        } );
        anim.addEventListener( 'error', () => {
            showFallback( wrapper, LOTTIE_HINT );
        } );

        if ( ! aspectRatioAttr ) {
            anim.addEventListener( 'DOMLoaded', () => {
                const w = anim.animationData?.w;
                const h = anim.animationData?.h;
                if ( w && h ) {
                    wrapper.style.aspectRatio = `${ w } / ${ h }`;
                }
            } );
        }

        if ( autoplay && trigger === 'hover' ) {
            block.addEventListener( 'mouseenter', () => anim.play() );
            block.addEventListener( 'mouseleave', () => anim.pause() );
        }

        if ( autoplay && trigger === 'click' ) {
            block.style.cursor = 'pointer';
            block.addEventListener( 'click', () => {
                if ( anim.isPaused ) {
                    anim.play();
                } else {
                    anim.pause();
                }
            } );
        }

        if ( autoplay && trigger === 'scroll' ) {
            const observer = new IntersectionObserver( ( entries ) => {
                entries.forEach( ( entry ) => {
                    if ( entry.isIntersecting ) {
                        anim.play();
                        observer.unobserve( block );
                    }
                } );
            }, { threshold: 0.3 } );
            observer.observe( block );
        }
    }
} );