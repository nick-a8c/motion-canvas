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
        } );
    }

    if ( animationType === 'spline' ) {
        const splineUrl = block.dataset.splineUrl;
        if ( ! splineUrl ) return;

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
    }

    if ( animationType === 'lottie' ) {
        const lottieContainer = document.createElement( 'div' );
        lottieContainer.style.width = '100%';
        lottieContainer.style.height = '100%';
        wrapper.appendChild( lottieContainer );

        const anim = lottie.loadAnimation( {
            container: lottieContainer,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: fileUrl,
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
    }
} );