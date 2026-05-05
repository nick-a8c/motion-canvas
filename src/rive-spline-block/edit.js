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

const TYPE_OPTIONS = [
	{ label: 'Rive (.riv)', value: 'rive' },
	{ label: 'Spline', value: 'spline' },
	{ label: 'Lottie (JSON)', value: 'lottie' },
];

// Short helper text shown under the format dropdown in the empty
// placeholder. Explains what each format is for users who may not
// recognize the name.
const TYPE_HELPER_TEXT = {
	rive: __( 'Interactive vector animations. Upload a .riv file from Rive.', 'rive-spline-block' ),
	spline: __( '3D scenes from spline.design. Paste the public viewer URL.', 'rive-spline-block' ),
	lottie: __( 'Lightweight JSON animations from After Effects. Upload a .json file.', 'rive-spline-block' ),
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
		return { ok: false, message: __('Please paste a URL.', 'rive-spline-block') };
	}

	if (/<iframe|<\/iframe>/i.test(trimmed)) {
		return {
			ok: false,
			message: __(
				'Looks like you pasted embed code. Use the public viewer URL instead — the one that starts with https://my.spline.design/',
				'rive-spline-block'
			),
		};
	}

	if (/<hana-viewer|<script[^>]*hana-viewer/i.test(trimmed)) {
		return {
			ok: false,
			message: __(
				'Looks like you pasted Hana embed code. Use the public viewer URL instead — the one that starts with https://my.spline.design/',
				'rive-spline-block'
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
			message: __('That doesn\'t look like a valid URL.', 'rive-spline-block'),
		};
	}

	if (parsed.protocol !== 'https:') {
		return {
			ok: false,
			message: __('Spline URLs must start with https://', 'rive-spline-block'),
		};
	}

	if (!/(^|\.)spline\.design$/i.test(parsed.hostname)) {
		return {
			ok: false,
			message: __(
				'That doesn\'t look like a Spline URL. It should be on spline.design.',
				'rive-spline-block'
			),
		};
	}

	return { ok: true, url: withProtocol };
};

// Check if the URL actually responds successfully. Returns a promise:
//   - { ok: true } → URL works
//   - { ok: false, message } → URL is broken with a user-friendly reason
//   - { ok: true, unverified: true } → CORS blocked, can't verify either way
//
// Spline's my.spline.design URLs typically allow some level of CORS for
// reading the page (it's an embed). S3 AccessDenied responses do too,
// since they're public XML errors. So we can usually distinguish.
const verifySplineUrlReachable = async (url) => {
	try {
		const response = await fetch(url, {
			method: 'GET',
			mode: 'cors',
			redirect: 'follow',
		});

		// Got a response with readable status.
		if (!response.ok) {
			// 403, 404, 500, etc.
			return {
				ok: false,
				message: __(
					'This URL didn\'t load. Make sure your Spline scene is published and the link is correct.',
					'rive-spline-block'
				),
			};
		}

		// 200 OK — but we should check the body for AccessDenied XML,
		// since S3 sometimes returns 200 with error content (rare but
		// possible). If body contains "AccessDenied", treat as broken.
		try {
			const text = await response.text();
			if (/<Code>AccessDenied<\/Code>|AccessDeniedAccess Denied/i.test(text)) {
				return {
					ok: false,
					message: __(
						'This Spline scene isn\'t public. Make sure the scene is set to public in Spline.',
						'rive-spline-block'
					),
				};
			}
		} catch (e) {
			// Couldn't read body (CORS on body but not status) — accept.
		}

		return { ok: true };
	} catch (e) {
		// CORS blocked, network failure, or other fetch error.
		// We can't tell if URL is good or bad — accept it and let the
		// runtime fallback handle bad cases at render time.
		return { ok: true, unverified: true };
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

	// Outer wrapper React owns. Inner div is created/destroyed by us
	// imperatively and is what we hand to lottie-web — keeping lottie's
	// DOM mutations completely outside React's reconciliation tree.
	const lottieWrapperRef = useRef(null);
	const blockProps = useBlockProps();

	const [splineUrlDraft, setSplineUrlDraft] = useState(splineUrl || '');
	const [splineError, setSplineError] = useState(null);
	const [splineChecking, setSplineChecking] = useState(false);
	const [pendingFormatSwitch, setPendingFormatSwitch] = useState(null);

	// Sidebar field has its own local draft so we don't fire validation
	// on every keystroke. Validates on blur.
	const [sidebarUrlDraft, setSidebarUrlDraft] = useState(splineUrl || '');
	const [sidebarError, setSidebarError] = useState(null);
	const [sidebarChecking, setSidebarChecking] = useState(false);

	// Keep the sidebar draft in sync if splineUrl changes from elsewhere
	// (e.g. the inline placeholder saved a URL, or format switch cleared it).
	useEffect(() => {
		setSidebarUrlDraft(splineUrl || '');
		setSidebarError(null);
	}, [splineUrl]);

	// Lottie editor preview, isolated from React.
	//
	// PROBLEM: lottie-web appends an SVG to whatever container you give
	// it. If that container is React-managed (a div with a ref), React
	// later tries to reconcile or unmount the container and walks
	// children it thinks should still be there → NotFoundError on
	// removeChild.
	//
	// FIX: never give lottie a React-managed div. We render a clean
	// outer wrapper, then create our own inner div imperatively and
	// hand THAT to lottie. React only knows about the outer wrapper —
	// the inner div is opaque to its reconciler.
	useEffect(() => {
		if (!fileUrl) return;
		if (animationType !== 'lottie') return;

		const wrapper = lottieWrapperRef.current;
		if (!wrapper) return;

		// Create the inner div lottie will own. React never sees inside
		// this — as far as React knows, the wrapper just contains "a
		// div" and that's it.
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

			// Remove the inner div ourselves. Since React never knew
			// about its contents, removing it can't conflict with
			// React's reconciliation.
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
				return __('Upload Rive file (.riv)', 'rive-spline-block');
			case 'lottie':
				return __('Upload Lottie file (.json)', 'rive-spline-block');
			default:
				return __('Upload Animation File', 'rive-spline-block');
		}
	};

	const handleSplineSubmit = async () => {
		const result = validateSplineUrl(splineUrlDraft);
		if (!result.ok) {
			setSplineError(result.message);
			return;
		}
		setSplineError(null);

		// Shape is valid. Now check if the URL is actually reachable.
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

	// Validate the sidebar URL on blur. If valid, commit to attribute.
	// If invalid, show error and leave the draft showing what the user
	// typed so they can fix it.
	const handleSidebarUrlBlur = async () => {
		const trimmed = (sidebarUrlDraft || '').trim();

		// If they cleared the field entirely, allow that — clears splineUrl.
		if (!trimmed) {
			setSidebarError(null);
			if (splineUrl) setAttributes({ splineUrl: '' });
			return;
		}

		// If they didn't actually change it, don't re-validate.
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
						icon="format-video"
						label={ __( 'Format', 'rive-spline-block' ) }
						text={ getTypeLabel( animationType ) }
						controls={ toolbarFormatControls }
					/>
				</ToolbarGroup>
			</BlockControls>

			<InspectorControls>
				<PanelBody title={__('Animation Settings', 'rive-spline-block')}>
					<SelectControl
						label={__('Animation Type', 'rive-spline-block')}
						value={animationType}
						options={TYPE_OPTIONS}
						onChange={(val) => requestToolbarFormatChange(val)}
					/>
					<TextControl
						label={__('Aspect ratio (optional)', 'rive-spline-block')}
						help={__('e.g. 16/9, 1/1, 4/3. Leave blank to use the file\'s native ratio.', 'rive-spline-block')}
						value={aspectRatio || ''}
						onChange={(val) => setAttributes({ aspectRatio: val })}
					/>
					<RangeControl
						label={__('Max width (px)', 'rive-spline-block')}
						help={__('Cap the block\'s maximum width. Leave blank to use the default (600px for centered blocks).', 'rive-spline-block')}
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
								label={__('Trigger', 'rive-spline-block')}
								help={__('When should the animation start?', 'rive-spline-block')}
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
								label={__('Autoplay', 'rive-spline-block')}
								help={__('Start playing automatically when the trigger fires.', 'rive-spline-block')}
								checked={autoplay}
								onChange={(val) => setAttributes({ autoplay: val })}
							/>
							<ToggleControl
								label={__('Loop', 'rive-spline-block')}
								help={__('Repeat the animation when it ends.', 'rive-spline-block')}
								checked={loop}
								onChange={(val) => setAttributes({ loop: val })}
							/>
							<RangeControl
								label={__('Playback speed', 'rive-spline-block')}
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
								label={__('Spline Public URL', 'rive-spline-block')}
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
										? __('Checking URL…', 'rive-spline-block')
										: __('Click away from the field to validate.', 'rive-spline-block')
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
								allowedTypes={['application/json', 'application/octet-stream']}
								render={({ open }) => (
									<Button variant="primary" onClick={open}>
										{fileUrl
											? __('Replace File', 'rive-spline-block')
											: __('Upload Animation File', 'rive-spline-block')}
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
					title={__('Scroll reveal', 'rive-spline-block')}
					initialOpen={false}
				>
					<p style={{ marginTop: 0, marginBottom: '12px', color: '#757575', fontSize: '12px' }}>
						{__(
							'Animate this block into view as visitors scroll. Disabled by default.',
							'rive-spline-block'
						)}
					</p>

					<SelectControl
						label={__('Reveal style', 'rive-spline-block')}
						value={revealStyle || 'none'}
						options={REVEAL_STYLE_OPTIONS}
						onChange={(val) => setAttributes({ revealStyle: val })}
					/>

					<SelectControl
						label={__('Speed', 'rive-spline-block')}
						value={revealSpeed || 'smooth'}
						options={REVEAL_SPEED_OPTIONS}
						onChange={(val) => setAttributes({ revealSpeed: val })}
						disabled={!revealEnabled}
					/>

					{revealEnabled && (
						<p style={{ marginTop: '12px', color: '#757575', fontSize: '11px', fontStyle: 'italic' }}>
							{__(
								'Reveal runs once when the block enters view. Visitors who prefer reduced motion will see content appear instantly.',
								'rive-spline-block'
							)}
						</p>
					)}
				</PanelBody>
			</InspectorControls>

			<div {...blockProps}>
				{!hasContent ? (
					<div style={{
						...wrapperStyle,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '12px',
						background: '#1a1a2e',
						padding: '24px 20px',
					}}>
						<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
							<circle cx="24" cy="24" r="24" fill="#333355" />
							<text x="24" y="30" textAnchor="middle" fontSize="20" fill="#8888ff">✦</text>
						</svg>

						<p style={{
							color: '#ccccdd',
							fontSize: '14px',
							margin: 0,
							textAlign: 'center',
							maxWidth: '320px',
							lineHeight: 1.4,
						}}>
							{__('Embed an interactive animation. Pick a format below.', 'rive-spline-block')}
						</p>

						<div style={{ width: '100%', maxWidth: '320px' }}>
							<SelectControl
								label={__('Format', 'rive-spline-block')}
								value={animationType}
								options={TYPE_OPTIONS}
								onChange={handleInlineTypeChange}
								__nextHasNoMarginBottom
							/>
						</div>

						<p style={{
							color: '#8888aa',
							fontSize: '12px',
							margin: 0,
							textAlign: 'center',
							maxWidth: '320px',
							lineHeight: 1.4,
							fontStyle: 'italic',
						}}>
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
												{__('Checking…', 'rive-spline-block')}
											</span>
										</>
									) : (
										__('Use this URL', 'rive-spline-block')
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
									allowedTypes={['application/json', 'application/octet-stream']}
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
					<div style={{
						...wrapperStyle,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: '#1a1a2e',
					}}>
						<p style={{ color: '#8888aa', fontSize: '13px', margin: 0, textAlign: 'center' }}>
							{__('⚡ Renders on frontend', 'rive-spline-block')}
						</p>
					</div>
				)}
			</div>

			{ pendingFormatSwitch && (
				<Modal
					title={ __( 'Switch animation format?', 'rive-spline-block' ) }
					onRequestClose={ cancelFormatSwitch }
					size="small"
				>
					<p style={ { marginTop: 0 } }>
						{ __(
							'Switching format will remove your current file. You can upload a new one after.',
							'rive-spline-block'
						) }
					</p>
					<p style={ { color: '#757575', fontSize: '13px' } }>
						{ __( 'From: ', 'rive-spline-block' ) }
						<strong>{ getTypeLabel( animationType ) }</strong>
						{ __( ' → To: ', 'rive-spline-block' ) }
						<strong>{ getTypeLabel( pendingFormatSwitch ) }</strong>
					</p>
					<div style={ { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' } }>
						<Button variant="tertiary" onClick={ cancelFormatSwitch }>
							{ __( 'Cancel', 'rive-spline-block' ) }
						</Button>
						<Button variant="primary" isDestructive onClick={ confirmFormatSwitch }>
							{ __( 'Switch and remove file', 'rive-spline-block' ) }
						</Button>
					</div>
				</Modal>
			) }
		</>
	);
}