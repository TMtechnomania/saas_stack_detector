/*
  Simple PNG icon generator for SaaS Stack Detector
  Creates valid minimal PNG icons at 16, 48, 128 sizes.
  Run: node generate_icons.js
*/
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function createPNG(size) {
	const bg = [11, 15, 26]; // #0b0f1a
	const fg = [0, 114, 255]; // #0072ff
	const fg2 = [0, 198, 255]; // #00c6ff

	// Create raw RGBA pixel data
	const pixels = Buffer.alloc(size * size * 4);

	const cx = size / 2;
	const cy = size / 2;
	const scale = size / 128;

	// Fill background
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const i = (y * size + x) * 4;
			// Rounded rect check
			const radius = size * 0.22;
			const inside = isInsideRoundedRect(x, y, 0, 0, size, size, radius);
			if (inside) {
				pixels[i] = bg[0];
				pixels[i + 1] = bg[1];
				pixels[i + 2] = bg[2];
				pixels[i + 3] = 255;
			} else {
				pixels[i + 3] = 0; // transparent
			}
		}
	}

	// Draw 3 diamond layers
	const layers = [
		{ offsetY: -19, opacity: 0.95 },
		{ offsetY: -6, opacity: 0.65 },
		{ offsetY: 7, opacity: 0.4 },
	];

	layers.forEach((layer, li) => {
		const halfW = 38 * scale;
		const halfH = 19 * scale;
		const centerY = cy + layer.offsetY * scale;

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const dx = Math.abs(x - cx);
				const dy = Math.abs(y - centerY);
				// Diamond test: dx/halfW + dy/halfH <= 1
				if (dx / halfW + dy / halfH <= 1) {
					const i = (y * size + x) * 4;
					if (pixels[i + 3] === 0) continue; // outside rounded rect
					// Gradient from fg to fg2 based on x
					const t = x / size;
					const r = Math.round(fg[0] * (1 - t) + fg2[0] * t);
					const g = Math.round(fg[1] * (1 - t) + fg2[1] * t);
					const b = Math.round(fg[2] * (1 - t) + fg2[2] * t);
					// Alpha blend
					const alpha = layer.opacity;
					pixels[i] = Math.round(pixels[i] * (1 - alpha) + r * alpha);
					pixels[i + 1] = Math.round(
						pixels[i + 1] * (1 - alpha) + g * alpha,
					);
					pixels[i + 2] = Math.round(
						pixels[i + 2] * (1 - alpha) + b * alpha,
					);
				}
			}
		}
	});

	// Convert pixels to PNG format
	// Add filter byte (0 = None) before each row
	const rawData = Buffer.alloc(size * (size * 4 + 1));
	for (let y = 0; y < size; y++) {
		rawData[y * (size * 4 + 1)] = 0; // filter byte
		pixels.copy(
			rawData,
			y * (size * 4 + 1) + 1,
			y * size * 4,
			(y + 1) * size * 4,
		);
	}

	const compressed = zlib.deflateSync(rawData);

	// Build PNG
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

	// IHDR
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0); // width
	ihdr.writeUInt32BE(size, 4); // height
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // color type (RGBA)
	ihdr[10] = 0; // compression
	ihdr[11] = 0; // filter
	ihdr[12] = 0; // interlace

	const ihdrChunk = makeChunk("IHDR", ihdr);
	const idatChunk = makeChunk("IDAT", compressed);
	const iendChunk = makeChunk("IEND", Buffer.alloc(0));

	return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);

	const typeBuffer = Buffer.from(type, "ascii");
	const crcData = Buffer.concat([typeBuffer, data]);

	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(crcData), 0);

	return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
	let crc = 0xffffffff;
	for (let i = 0; i < buf.length; i++) {
		crc = crc ^ buf[i];
		for (let j = 0; j < 8; j++) {
			if (crc & 1) {
				crc = (crc >>> 1) ^ 0xedb88320;
			} else {
				crc = crc >>> 1;
			}
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function isInsideRoundedRect(px, py, rx, ry, rw, rh, r) {
	// Clamp radius
	r = Math.min(r, rw / 2, rh / 2);
	if (px >= rx + r && px <= rx + rw - r && py >= ry && py <= ry + rh)
		return true;
	if (px >= rx && px <= rx + rw && py >= ry + r && py <= ry + rh - r)
		return true;
	// Corner checks
	const corners = [
		[rx + r, ry + r],
		[rx + rw - r, ry + r],
		[rx + r, ry + rh - r],
		[rx + rw - r, ry + rh - r],
	];
	for (const [cx, cy] of corners) {
		const dx = px - cx;
		const dy = py - cy;
		if (dx * dx + dy * dy <= r * r) return true;
	}
	return false;
}

// Generate icons
const dir = __dirname;
[16, 48, 128].forEach((size) => {
	const png = createPNG(size);
	const filePath = path.join(dir, `icon${size}.png`);
	fs.writeFileSync(filePath, png);
	console.log(`Created ${filePath} (${png.length} bytes)`);
});

console.log("Done!");
