import { useBlockProps } from '@wordpress/block-editor';

export default function save( { attributes } ) {
    const { fileUrl, splineUrl, animationType, aspectRatio } = attributes;

    const hasContent = animationType === 'spline' ? !! splineUrl : !! fileUrl;
    if ( ! hasContent ) return null;

    const blockProps = useBlockProps.save( {
        'data-file-url': fileUrl || '',
        'data-spline-url': splineUrl || '',
        'data-animation-type': animationType || 'rive',
        'data-aspect-ratio': aspectRatio || '',
    } );

    return <div { ...blockProps } />;
}