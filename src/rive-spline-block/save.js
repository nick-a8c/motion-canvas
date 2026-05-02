import { useBlockProps } from '@wordpress/block-editor';

export default function save( { attributes } ) {
    const { fileUrl, splineUrl, animationType, aspectRatio, maxWidth, loop, autoplay, playbackSpeed, trigger } = attributes;
    const hasContent = animationType === 'spline' ? !! splineUrl : !! fileUrl;
    if ( ! hasContent ) return null;

    const blockProps = useBlockProps.save( {
        'data-file-url': fileUrl || '',
        'data-spline-url': splineUrl || '',
        'data-animation-type': animationType || 'rive',
        'data-aspect-ratio': aspectRatio || '',
        'data-loop': loop ? '1' : '0',
        'data-autoplay': autoplay ? '1' : '0',
        'data-playback-speed': String( playbackSpeed ?? 1 ),
        'data-trigger': trigger || 'autoplay',
        style: maxWidth ? { maxWidth: `${ maxWidth }px` } : undefined,
    } );

    return <div { ...blockProps } />;
}