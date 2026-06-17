import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
	BlockControls,
	MediaUpload,
	MediaUploadCheck,
} from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
	Button,
	TextControl,
	ToggleControl,
	RangeControl,
	Notice,
	ToolbarGroup,
	ToolbarDropdownMenu,
	Modal,
	Spinner,
} from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import './editor.scss';
const TOOLBAR_FORMAT_ICON = (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="3" y="3" width="2" height="18" rx="1" fill="#1D1D1D"/>
		<rect x="19" y="3" width="2" height="18" rx="1" fill="#1D1D1D"/>
		<circle cx="9" cy="17" r="2" fill="#1D1D1D"/>
		<circle cx="13" cy="14" r="2" fill="#8D8D8D"/>
		<circle cx="17" cy="11" r="2" fill="#B2B2B2"/>
		<circle cx="13" cy="8" r="2" fill="#E3E3E3"/>
	</svg>
);

const TYPE_OPTIONS = [
	{ label: 'Rive (.riv)', value: 'rive' },
	{ label: 'Spline', value: 'spline' },
	{ label: 'Lottie (JSON)', value: 'lottie' },
	{ label: 'HTML (.html)', value: 'html' },
];

// Short helper text shown under the format dropdown in the empty
// placeholder. Explains what each format is for users who may not
// recognize the name.
const TYPE_HELPER_TEXT = {
	rive: __( 'Interactive vector animations. Upload a .riv file from Rive.', 'motion-canvas' ),
	spline: __( '3D scenes from spline.design. Paste the public viewer URL.', 'motion-canvas' ),
	lottie: __( 'Lightweight JSON animations from After Effects. Upload a .json file.', 'motion-canvas' ),
	html: __( 'Standalone HTML animation. Upload a self-contained .html file.', 'motion-canvas' ),
};

const REVEAL_STYLE_OPTIONS = [
	{ label: 'None', value: 'none' },
	{ label: 'Fade', value: 'fade' },
	{ label: 'Fade up', value: 'fade-up' },
	{ label: 'Zoom', value: 'zoom' },
	{ label: 'Blur', value: 'blur' },
	{ label: 'Slide in', value: 'slide' },
];

const REVEAL_SPEED_OPTIONS = [
	{ label: 'Snappy', value: 'snappy' },
	{ label: 'Smooth', value: 'smooth' },
	{ label: 'Slow & cinematic', value: 'cinematic' },
];

const getTypeLabel = ( value ) => {
	const match = TYPE_OPTIONS.find( ( opt ) => opt.value === value );
	return match ? match.label : value;
};

const validateSplineUrl = (raw) => {
	const trimmed = (raw || '').trim();

	if (!trimmed) {
		return { ok: false, message: __('Please paste a URL.', 'motion-canvas') };
	}

	if (/<iframe|<\/iframe>/i.test(trimmed)) {
		return {
			ok: false,
			message: __(
				'Looks like you pasted embed code. Use the public viewer URL instead — the one that starts with https://my.spline.design/',
				'motion-canvas'
			),
		};
	}

	if (/<hana-viewer|<script[^>]*hana-viewer/i.test(trimmed)) {
		return {
			ok: false,
			message: __(
				'Looks like you pasted Hana embed code. Use the public viewer URL instead — the one that starts with https://my.spline.design/',
				'motion-canvas'
			),
		};
	}

	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

	let parsed;
	try {
		parsed = new URL(withProtocol);
	} catch (e) {
		return {
			ok: false,
			message: __('That doesn\'t look like a valid URL.', 'motion-canvas'),
		};
	}

	if (parsed.protocol !== 'https:') {
		return {
			ok: false,
			message: __('Spline URLs must start with https://', 'motion-canvas'),
		};
	}

	if (!/(^|\.)spline\.design$/i.test(parsed.hostname)) {
		return {
			ok: false,
			message: __(
				'That doesn\'t look like a Spline URL. It should be on spline.design.',
				'motion-canvas'
			),
		};
	}

	return { ok: true, url: withProtocol };
};

const verifySplineUrlReachable = async (url) => {
	try {
		const response = await fetch(url, {
			method: 'GET',
			mode: 'cors',
			redirect: 'follow',
		});

		if (!response.ok) {
			return {
				ok: false,
				message: __(
					'This URL didn\'t load. Make sure your Spline scene is published and the link is correct.',
					'motion-canvas'
				),
			};
		}

		try {
			const text = await response.text();
			if (/<Code>AccessDenied<\/Code>|AccessDeniedAccess Denied/i.test(text)) {
				return {
					ok: false,
					message: __(
						'This Spline scene isn\'t public. Make sure the scene is set to public in Spline.',
						'motion-canvas'
					),
				};
			}
		} catch (e) {
			// Couldn't read body — accept.
		}

		return { ok: true };
	} catch (e) {
		return { ok: true, unverified: true };
	}
};

// File-upload allowed-types list per format. Spline doesn't use upload.
const allowedTypesForFormat = ( animationType ) => {
	switch ( animationType ) {
		case 'html':
			return [ 'text/html' ];
		case 'lottie':
			return [ 'application/json' ];
		case 'rive':
		default:
			return [ 'application/json', 'application/octet-stream' ];
	}
};

export default function Edit({ attributes, setAttributes }) {
	const {
		fileUrl,
		splineUrl,
		animationType,
		aspectRatio,
		maxWidth,
		loop,
		autoplay,
		playbackSpeed,
		trigger,
		revealStyle,
		revealSpeed,
	} = attributes;

	const lottieWrapperRef = useRef(null);
	const blockProps = useBlockProps();

	const [splineUrlDraft, setSplineUrlDraft] = useState(splineUrl || '');
	const [splineError, setSplineError] = useState(null);
	const [splineChecking, setSplineChecking] = useState(false);
	const [pendingFormatSwitch, setPendingFormatSwitch] = useState(null);

	const [sidebarUrlDraft, setSidebarUrlDraft] = useState(splineUrl || '');
	const [sidebarError, setSidebarError] = useState(null);
	const [sidebarChecking, setSidebarChecking] = useState(false);

	useEffect(() => {
		setSidebarUrlDraft(splineUrl || '');
		setSidebarError(null);
	}, [splineUrl]);

	// Lottie editor preview, isolated from React's reconciliation.
	useEffect(() => {
		if (!fileUrl) return;
		if (animationType !== 'lottie') return;

		const wrapper = lottieWrapperRef.current;
		if (!wrapper) return;

		const innerContainer = document.createElement('div');
		innerContainer.style.width = '100%';
		innerContainer.style.height = '100%';
		wrapper.appendChild(innerContainer);

		let cancelled = false;
		let anim = null;

		import('lottie-web').then((lottie) => {
			if (cancelled) return;

			anim = lottie.default.loadAnimation({
				container: innerContainer,
				renderer: 'svg',
				loop: true,
				autoplay: true,
				path: fileUrl,
			});
		});

		return () => {
			cancelled = true;

			if (anim) {
				try {
					anim.destroy();
				} catch (e) {
					// Defensive.
				}
			}

			if (innerContainer.parentNode === wrapper) {
				wrapper.removeChild(innerContainer);
			}
		};
	}, [fileUrl, animationType]);

	const hasContent = animationType === 'spline' ? !!splineUrl : !!fileUrl;

	const wrapperStyle = {
		width: '100%',
		aspectRatio: aspectRatio || '16 / 9',
		position: 'relative',
	};

	const uploadLabel = () => {
		switch (animationType) {
			case 'rive':
				return __('Upload Rive file (.riv)', 'motion-canvas');
			case 'lottie':
				return __('Upload Lottie file (.json)', 'motion-canvas');
			case 'html':
				return __('Upload HTML file (.html)', 'motion-canvas');
			default:
				return __('Upload Animation File', 'motion-canvas');
		}
	};

	const handleSplineSubmit = async () => {
		const result = validateSplineUrl(splineUrlDraft);
		if (!result.ok) {
			setSplineError(result.message);
			return;
		}
		setSplineError(null);

		setSplineChecking(true);
		const reachability = await verifySplineUrlReachable(result.url);
		setSplineChecking(false);

		if (!reachability.ok) {
			setSplineError(reachability.message);
			return;
		}

		setSplineUrlDraft(result.url);
		setAttributes({ splineUrl: result.url });
	};

	const handleSidebarUrlBlur = async () => {
		const trimmed = (sidebarUrlDraft || '').trim();

		if (!trimmed) {
			setSidebarError(null);
			if (splineUrl) setAttributes({ splineUrl: '' });
			return;
		}

		if (trimmed === splineUrl) {
			setSidebarError(null);
			return;
		}

		const result = validateSplineUrl(sidebarUrlDraft);
		if (!result.ok) {
			setSidebarError(result.message);
			return;
		}
		setSidebarError(null);

		setSidebarChecking(true);
		const reachability = await verifySplineUrlReachable(result.url);
		setSidebarChecking(false);

		if (!reachability.ok) {
			setSidebarError(reachability.message);
			return;
		}

		setSidebarUrlDraft(result.url);
		setAttributes({ splineUrl: result.url });
	};

	const handleInlineTypeChange = (newType) => {
		setAttributes({ animationType: newType });
		setSplineError(null);
	};

	const requestToolbarFormatChange = ( newType ) => {
		if ( newType === animationType ) return;
		if ( ! hasContent ) {
			setAttributes( { animationType: newType } );
			return;
		}
		setPendingFormatSwitch( newType );
	};

	const confirmFormatSwitch = () => {
		const newType = pendingFormatSwitch;
		const updates = { animationType: newType };

		if ( animationType === 'spline' ) {
			updates.splineUrl = '';
			setSplineUrlDraft( '' );
		} else {
			updates.fileUrl = '';
		}

		setAttributes( updates );
		setSplineError( null );
		setPendingFormatSwitch( null );
	};

	const cancelFormatSwitch = () => {
		setPendingFormatSwitch( null );
	};

	const toolbarFormatControls = TYPE_OPTIONS.map( ( option ) => ( {
		title: option.label,
		isActive: animationType === option.value,
		onClick: () => requestToolbarFormatChange( option.value ),
	} ) );

	const revealEnabled = revealStyle && revealStyle !== 'none';

	return (
		<>
			<BlockControls>
				<ToolbarGroup>
				<ToolbarDropdownMenu
					icon={ TOOLBAR_FORMAT_ICON }
					label={ __( 'Format', 'motion-canvas' ) }
					text={ getTypeLabel( animationType ) }
					controls={ toolbarFormatControls }
				/>
				</ToolbarGroup>
			</BlockControls>

			<InspectorControls>
				<PanelBody title={__('Animation Settings', 'motion-canvas')}>
					<SelectControl
						label={__('Animation Type', 'motion-canvas')}
						value={animationType}
						options={TYPE_OPTIONS}
						onChange={(val) => requestToolbarFormatChange(val)}
					/>
					<TextControl
						label={__('Aspect ratio (optional)', 'motion-canvas')}
						help={__('e.g. 16/9, 1/1, 4/3. Leave blank to use the file\'s native ratio.', 'motion-canvas')}
						value={aspectRatio || ''}
						onChange={(val) => setAttributes({ aspectRatio: val })}
					/>
					<RangeControl
						label={__('Max width (px)', 'motion-canvas')}
						help={__('Cap the block\'s maximum width. Leave blank to use the default (600px for centered blocks).', 'motion-canvas')}
						value={maxWidth}
						onChange={(val) => setAttributes({ maxWidth: val })}
						min={100}
						max={1200}
						step={10}
						allowReset
					/>
					{animationType === 'lottie' && (
						<>
							<SelectControl
								label={__('Trigger', 'motion-canvas')}
								help={__('When should the animation start?', 'motion-canvas')}
								value={trigger}
								options={[
									{ label: 'Autoplay (on page load)', value: 'autoplay' },
									{ label: 'On hover', value: 'hover' },
									{ label: 'On click', value: 'click' },
									{ label: 'On scroll into view', value: 'scroll' },
								]}
								onChange={(val) => setAttributes({ trigger: val })}
							/>
							<ToggleControl
								label={__('Autoplay', 'motion-canvas')}
								help={__('Start playing automatically when the trigger fires.', 'motion-canvas')}
								checked={autoplay}
								onChange={(val) => setAttributes({ autoplay: val })}
							/>
							<ToggleControl
								label={__('Loop', 'motion-canvas')}
								help={__('Repeat the animation when it ends.', 'motion-canvas')}
								checked={loop}
								onChange={(val) => setAttributes({ loop: val })}
							/>
							<RangeControl
								label={__('Playback speed', 'motion-canvas')}
								value={playbackSpeed}
								onChange={(val) => setAttributes({ playbackSpeed: val })}
								min={0.25}
								max={3}
								step={0.25}
							/>
						</>
					)}
					{animationType === 'spline' && (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
							<TextControl
								label={__('Spline Public URL', 'motion-canvas')}
								placeholder="https://my.spline.design/..."
								value={sidebarUrlDraft}
								onChange={(val) => {
									setSidebarUrlDraft(val);
									if (sidebarError) setSidebarError(null);
								}}
								onBlur={handleSidebarUrlBlur}
								disabled={sidebarChecking}
								help={
									sidebarChecking
										? __('Checking URL…', 'motion-canvas')
										: __('Click away from the field to validate.', 'motion-canvas')
								}
							/>
							{sidebarError && (
								<Notice status="error" isDismissible={false}>
									{sidebarError}
								</Notice>
							)}
						</div>
					)}
					{animationType !== 'spline' && (
						<MediaUploadCheck>
							<MediaUpload
								onSelect={(media) => setAttributes({ fileUrl: media.url })}
								allowedTypes={allowedTypesForFormat(animationType)}
								render={({ open }) => (
									<Button variant="primary" onClick={open}>
										{fileUrl
											? __('Replace File', 'motion-canvas')
											: uploadLabel()}
									</Button>
								)}
							/>
						</MediaUploadCheck>
					)}
					{fileUrl && animationType !== 'spline' && (
						<p style={{ marginTop: '8px', wordBreak: 'break-all', fontSize: '11px' }}>
							{fileUrl}
						</p>
					)}
				</PanelBody>

				<PanelBody
					title={__('Scroll reveal', 'motion-canvas')}
					initialOpen={false}
				>
					<p style={{ marginTop: 0, marginBottom: '12px', color: '#757575', fontSize: '12px' }}>
						{__(
							'Animate this block into view as visitors scroll. Disabled by default.',
							'motion-canvas'
						)}
					</p>

					<SelectControl
						label={__('Reveal style', 'motion-canvas')}
						value={revealStyle || 'none'}
						options={REVEAL_STYLE_OPTIONS}
						onChange={(val) => setAttributes({ revealStyle: val })}
					/>

					<SelectControl
						label={__('Speed', 'motion-canvas')}
						value={revealSpeed || 'smooth'}
						options={REVEAL_SPEED_OPTIONS}
						onChange={(val) => setAttributes({ revealSpeed: val })}
						disabled={!revealEnabled}
					/>

					{revealEnabled && (
						<p style={{ marginTop: '12px', color: '#757575', fontSize: '11px', fontStyle: 'italic' }}>
							{__(
								'Reveal runs once when the block enters view. Visitors who prefer reduced motion will see content appear instantly.',
								'motion-canvas'
							)}
						</p>
					)}
				</PanelBody>
			</InspectorControls>

			<div {...blockProps}>
			{!hasContent ? (
					<div
						className="mb-empty-placeholder"
						style={{
							...wrapperStyle,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '12px',
							padding: '24px 20px',
						}}
					>
						<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
						<g clipPath="url(#mb-empty-icon-clip)">
							
							<path d="M37.4114 26.2696C37.4114 29.7282 34.6076 32.532 31.149 32.532C27.6905 32.532 24.8867 29.7282 24.8867 26.2696C24.8867 22.8111 27.6905 20.0073 31.149 20.0073C34.6076 20.0073 37.4114 22.8111 37.4114 26.2696Z" fill="#007DBA"/>
							<path d="M37.086 36.2728C37.086 36.7219 34.3551 37.086 30.9864 37.086C27.6176 37.086 24.8867 36.7219 24.8867 36.2728C24.8867 35.8236 27.6176 35.4595 30.9864 35.4595C34.3551 35.4595 37.086 35.8236 37.086 36.2728Z" fill="#CCE4F0"/>
							<path opacity="0.2" d="M0.488037 13.6636C11.8741 13.6636 14.341 28.0859 14.1513 35.297C15.2473 25.7981 20.798 22.395 25.5373 24.0346" stroke="#0079B6" strokeWidth="1.1386"/>
						</g>
						<defs>
							<clipPath id="mb-empty-icon-clip">
								<rect width="48" height="48" rx="11" fill="white"/>
							</clipPath>
						</defs>
					</svg>

						<p
							className="mb-empty-placeholder__title"
							style={{
								fontSize: '14px',
								margin: 0,
								textAlign: 'center',
								maxWidth: '320px',
								lineHeight: 1.4,
							}}
						>
							{__('Embed an interactive animation. Pick a format below.', 'motion-canvas')}
						</p>

						<div style={{ width: '100%', maxWidth: '320px' }}>
							<SelectControl
								label={__('Format', 'motion-canvas')}
								value={animationType}
								options={TYPE_OPTIONS}
								onChange={handleInlineTypeChange}
								__nextHasNoMarginBottom
							/>
						</div>

						<p
							className="mb-empty-placeholder__hint"
							style={{
								fontSize: '12px',
								margin: 0,
								textAlign: 'center',
								maxWidth: '320px',
								lineHeight: 1.4,
								fontStyle: 'italic',
							}}
						>
							{TYPE_HELPER_TEXT[animationType]}
						</p>

						{animationType === 'spline' ? (
							<div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
								<TextControl
									value={splineUrlDraft}
									onChange={(val) => {
										setSplineUrlDraft(val);
										if (splineError) setSplineError(null);
									}}
									placeholder="https://my.spline.design/..."
									__nextHasNoMarginBottom
									disabled={splineChecking}
								/>
								<Button
									variant="primary"
									disabled={!splineUrlDraft.trim() || splineChecking}
									onClick={handleSplineSubmit}
									style={{ justifyContent: 'center' }}
								>
									{splineChecking ? (
										<>
											<Spinner />
											<span style={{ marginLeft: '6px' }}>
												{__('Checking…', 'motion-canvas')}
											</span>
										</>
									) : (
										__('Use this URL', 'motion-canvas')
									)}
								</Button>
								{splineError && (
									<Notice
										status="error"
										isDismissible={false}
									>
										{splineError}
									</Notice>
								)}
							</div>
						) : (
							<MediaUploadCheck>
								<MediaUpload
									onSelect={(media) => setAttributes({ fileUrl: media.url })}
									allowedTypes={allowedTypesForFormat(animationType)}
									render={({ open }) => (
										<Button variant="primary" onClick={open}>
											{uploadLabel()}
										</Button>
									)}
								/>
							</MediaUploadCheck>
						)}
					</div>
				) : animationType === 'lottie' ? (
					<div ref={lottieWrapperRef} style={wrapperStyle} />
				) : (
					<div
						className="mb-frontend-placeholder"
						style={{
							...wrapperStyle,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<p className="mb-frontend-placeholder__text" style={{ fontSize: '13px', margin: 0, textAlign: 'center' }}>
							{__('⚡ Renders on frontend', 'motion-canvas')}
						</p>
					</div>
				)}
			</div>

			{ pendingFormatSwitch && (
				<Modal
					title={ __( 'Switch animation format?', 'motion-canvas' ) }
					onRequestClose={ cancelFormatSwitch }
					size="small"
				>
					<p style={ { marginTop: 0 } }>
						{ __(
							'Switching format will remove your current file. You can upload a new one after.',
							'motion-canvas'
						) }
					</p>
					<p style={ { color: '#757575', fontSize: '13px' } }>
						{ __( 'From: ', 'motion-canvas' ) }
						<strong>{ getTypeLabel( animationType ) }</strong>
						{ __( ' → To: ', 'motion-canvas' ) }
						<strong>{ getTypeLabel( pendingFormatSwitch ) }</strong>
					</p>
					<div style={ { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' } }>
						<Button variant="tertiary" onClick={ cancelFormatSwitch }>
							{ __( 'Cancel', 'motion-canvas' ) }
						</Button>
						<Button variant="primary" isDestructive onClick={ confirmFormatSwitch }>
							{ __( 'Switch and remove file', 'motion-canvas' ) }
						</Button>
					</div>
				</Modal>
			) }
		</>
	);
}