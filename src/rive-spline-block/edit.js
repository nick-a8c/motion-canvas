import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { PanelBody, SelectControl, Button, TextControl } from '@wordpress/components';
import { useEffect, useRef } from '@wordpress/element';
import './editor.scss';

export default function Edit( { attributes, setAttributes } ) {
	const { fileUrl, splineUrl, animationType, aspectRatio } = attributes;
	const lottieContainerRef = useRef( null );
	const blockProps = useBlockProps();

	useEffect( () => {
		if ( ! fileUrl ) return;
		if ( animationType !== 'lottie' ) return;
		if ( ! lottieContainerRef.current ) return;

		let anim;
		import( 'lottie-web' ).then( ( lottie ) => {
			anim = lottie.default.loadAnimation( {
				container: lottieContainerRef.current,
				renderer: 'svg',
				loop: true,
				autoplay: true,
				path: fileUrl,
			} );
		} );

		return () => {
			if ( anim ) anim.destroy();
		};
	}, [ fileUrl, animationType ] );

	const hasContent = animationType === 'spline' ? !! splineUrl : !! fileUrl;

	// Wrapper style: aspect-ratio if set, otherwise let content size itself.
	// Falls back to 16/9 for placeholder so it doesn't collapse.
	const wrapperStyle = {
		width: '100%',
		aspectRatio: aspectRatio || '16 / 9',
		position: 'relative',
	};

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Animation Settings', 'rive-spline-block' ) }>
					<SelectControl
						label={ __( 'Animation Type', 'rive-spline-block' ) }
						value={ animationType }
						options={ [
							{ label: 'Rive (.riv)', value: 'rive' },
							{ label: 'Spline', value: 'spline' },
							{ label: 'Lottie (JSON)', value: 'lottie' },
						] }
						onChange={ ( val ) => setAttributes( { animationType: val } ) }
					/>
					<TextControl
						label={ __( 'Aspect ratio (optional)', 'rive-spline-block' ) }
						help={ __( 'e.g. 16/9, 1/1, 4/3. Leave blank to use the file\'s native ratio.', 'rive-spline-block' ) }
						value={ aspectRatio || '' }
						onChange={ ( val ) => setAttributes( { aspectRatio: val } ) }
					/>
					{ animationType === 'spline' && (
						<TextControl
							label={ __( 'Spline Public URL', 'rive-spline-block' ) }
							placeholder="https://my.spline.design/..."
							value={ splineUrl || '' }
							onChange={ ( val ) => setAttributes( { splineUrl: val } ) }
						/>
					) }
					{ animationType !== 'spline' && (
						<MediaUploadCheck>
							<MediaUpload
								onSelect={ ( media ) => setAttributes( { fileUrl: media.url } ) }
								allowedTypes={ [ 'application/json', 'application/octet-stream' ] }
								render={ ( { open } ) => (
									<Button variant="primary" onClick={ open }>
										{ fileUrl
											? __( 'Replace File', 'rive-spline-block' )
											: __( 'Upload Animation File', 'rive-spline-block' ) }
									</Button>
								) }
							/>
						</MediaUploadCheck>
					) }
					{ fileUrl && animationType !== 'spline' && (
						<p style={ { marginTop: '8px', wordBreak: 'break-all', fontSize: '11px' } }>
							{ fileUrl }
						</p>
					) }
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				{ ! hasContent ? (
					<div style={ {
						...wrapperStyle,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '12px',
						background: '#1a1a2e',
					} }>
						<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
							<circle cx="24" cy="24" r="24" fill="#333355"/>
							<text x="24" y="30" textAnchor="middle" fontSize="20" fill="#8888ff">✦</text>
						</svg>
						<p style={ { color: '#8888aa', fontSize: '13px', margin: 0, textAlign: 'center' } }>
							{ __( 'Upload a Rive, Spline, or Lottie file', 'rive-spline-block' ) }
						</p>
						<p style={ { color: '#555577', fontSize: '11px', margin: 0, textAlign: 'center' } }>
							{ __( 'Use the settings panel →', 'rive-spline-block' ) }
						</p>
					</div>
				) : animationType === 'lottie' ? (
					<div ref={ lottieContainerRef } style={ wrapperStyle } />
				) : (
					<div style={ {
						...wrapperStyle,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: '#1a1a2e',
					} }>
						<p style={ { color: '#8888aa', fontSize: '13px', margin: 0, textAlign: 'center' } }>
							{ __( '⚡ Renders on frontend', 'rive-spline-block' ) }
						</p>
					</div>
				) }
			</div>
		</>
	);
}