import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { PanelBody, SelectControl, Button, TextControl, ToggleControl, RangeControl, Notice } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import './editor.scss';

const TYPE_OPTIONS = [
	{ label: 'Rive (.riv)', value: 'rive' },
	{ label: 'Spline', value: 'spline' },
	{ label: 'Lottie (JSON)', value: 'lottie' },
];

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

export default function Edit({ attributes, setAttributes }) {
	const { fileUrl, splineUrl, animationType, aspectRatio, maxWidth, loop, autoplay, playbackSpeed, trigger } = attributes;
	const lottieContainerRef = useRef(null);
	const blockProps = useBlockProps();

	const [splineUrlDraft, setSplineUrlDraft] = useState(splineUrl || '');
	const [splineError, setSplineError] = useState(null);

	useEffect(() => {
		if (!fileUrl) return;
		if (animationType !== 'lottie') return;
		if (!lottieContainerRef.current) return;

		let anim;
		import('lottie-web').then((lottie) => {
			anim = lottie.default.loadAnimation({
				container: lottieContainerRef.current,
				renderer: 'svg',
				loop: true,
				autoplay: true,
				path: fileUrl,
			});
		});

		return () => {
			if (anim) anim.destroy();
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

	const handleSplineSubmit = () => {
		const result = validateSplineUrl(splineUrlDraft);
		if (!result.ok) {
			setSplineError(result.message);
			return;
		}
		setSplineError(null);
		setSplineUrlDraft(result.url);
		setAttributes({ splineUrl: result.url });
	};

	// When the user changes type from inside the empty placeholder, also
	// clear any stale draft state so the inputs feel fresh.
	const handleInlineTypeChange = (newType) => {
		setAttributes({ animationType: newType });
		setSplineError(null);
	};

	return (
		<>
			<InspectorControls>
				<PanelBody title={__('Animation Settings', 'rive-spline-block')}>
					<SelectControl
						label={__('Animation Type', 'rive-spline-block')}
						value={animationType}
						options={TYPE_OPTIONS}
						onChange={(val) => setAttributes({ animationType: val })}
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
						<TextControl
							label={__('Spline Public URL', 'rive-spline-block')}
							placeholder="https://my.spline.design/..."
							value={splineUrl || ''}
							onChange={(val) => setAttributes({ splineUrl: val })}
						/>
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
						padding: '20px',
					}}>
						<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
							<circle cx="24" cy="24" r="24" fill="#333355" />
							<text x="24" y="30" textAnchor="middle" fontSize="20" fill="#8888ff">✦</text>
						</svg>

						{/* Inline format picker — saves a sidebar trip when first setting up the block. */}
						<div style={{ width: '100%', maxWidth: '320px' }}>
							<SelectControl
								label={__('Format', 'rive-spline-block')}
								value={animationType}
								options={TYPE_OPTIONS}
								onChange={handleInlineTypeChange}
								__nextHasNoMarginBottom
							/>
						</div>

						<p style={{ color: '#8888aa', fontSize: '13px', margin: 0, textAlign: 'center' }}>
							{animationType === 'spline'
								? __('Paste your Spline public viewer URL', 'rive-spline-block')
								: __('Add your animation file', 'rive-spline-block')}
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
									help={__('Use the public viewer URL, not the embed code.', 'rive-spline-block')}
									__nextHasNoMarginBottom
								/>
								<Button
									variant="primary"
									disabled={!splineUrlDraft.trim()}
									onClick={handleSplineSubmit}
									style={{ justifyContent: 'center' }}
								>
									{__('Use this URL', 'rive-spline-block')}
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
					<div ref={lottieContainerRef} style={wrapperStyle} />
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
		</>
	);
}