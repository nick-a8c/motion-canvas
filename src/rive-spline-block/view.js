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
// remediation differs (Spline = wrong URL, Rive/Lottie = bad file).
//
// hintHTML may contain inline <strong> tags for emphasis.
function buildFallbackOverlay( hintHTML ) {
    const overlay = document.createElement( 'div' );
    overlay.className = 'rsb-fallback-overlay';
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

// Format-specific hint copy.
const SPLINE_HINT = 'Please check if the <strong style="color:#ccccdd">URL</strong> from Spline is <strong style="color:#ccccdd">correct</strong>.';
const RIVE_HINT = 'Make sure the file is a valid <strong style="color:#ccccdd">.riv</strong> export from Rive.';
const LOTTIE_HINT = 'Make sure the file is a valid <strong style="color:#ccccdd">Lottie JSON</strong> export.';

// Helper: replace the wrapper's contents with a fallback overlay.
// Used by all three animation types when their load fails.
function showFallback( wrapper, hintHTML ) {
    // If a fallback is already showing, don't stack another one.
    if ( wrapper.querySelector( '.rsb-fallback-overlay' ) ) return;
    const overlay = buildFallbackOverlay( hintHTML );
    wrapper.appendChild( overlay );
}

// Mount a Spline iframe inside the wrapper. If the iframe never fires
// 'load' within 8 seconds (true network failure), or fires 'error',
// show the friendly fallback overlay. Primary URL validation happens
// in the editor (edit.js); this is the runtime safety net.
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

    // 8s is generous — Spline scenes are usually responsive within
    // 2-3s on a normal connection. If 'load' hasn't fired by then,
    // the iframe is genuinely stuck.
    setTimeout( () => {
        if ( ! loaded ) showFallback( wrapper, SPLINE_HINT );
    }, 8000 );
}

document.querySelectorAll( '.wp-block-create-block-rive-spline-block' ).forEach( ( block ) => {
    const fileUrl = block.dataset.fileUrl;
    const animationType = block.dataset.animationType;
    const aspectRatioAttr = block.dataset.aspectRatio;

    if ( ! fileUrl && ! block.dataset.splineUrl ) return;

    const wrapper = document.createElement( 'div' );
    wrapper.className = 'rsb-canvas-wrapper';
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
            // Rive fires onLoadError when:
            //  - The file at src isn't reachable (404, network)
            //  - The file isn't a valid .riv (parse failure)
            //  - The runtime hits an internal error initializing
            // In any case we treat it the same: show the fallback.
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

    if ( animationType === 'lottie' ) {
        const lottieContainer = document.createElement( 'div' );
        lottieContainer.style.width = '100%';
        lottieContainer.style.height = '100%';
        wrapper.appendChild( lottieContainer );

        // Read the new attributes from the block element.
        const loop = block.dataset.loop !== '0';
        const autoplay = block.dataset.autoplay !== '0';
        const playbackSpeed = parseFloat( block.dataset.playbackSpeed ) || 1;
        const trigger = block.dataset.trigger || 'autoplay';

        // For non-autoplay triggers, we load the animation paused
        // and start it ourselves when the trigger fires.
        const shouldAutoplayOnLoad = autoplay && trigger === 'autoplay';

        const anim = lottie.loadAnimation( {
            container: lottieContainer,
            renderer: 'svg',
            loop,
            autoplay: shouldAutoplayOnLoad,
            path: fileUrl,
        } );

        anim.setSpeed( playbackSpeed );

        // Lottie fires 'data_failed' when the JSON can't be fetched
        // (404, CORS) and 'error' for runtime errors after load.
        // Both should show the same fallback.
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

        // Wire up triggers other than "autoplay".
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