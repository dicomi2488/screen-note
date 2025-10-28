// 可复用的小工具按钮（目前简单封装）
export default function createToolbarButton({ label, icon, onClick } = {}) {
	const btn = document.createElement('button');
	btn.className = 'sn-tool';
	btn.type = 'button';
	if (icon) {
		const img = document.createElement('img');
		img.src = icon;
		img.alt = label || '';
		btn.appendChild(img);
	} else {
		btn.textContent = label || '·';
	}
	if (onClick) btn.addEventListener('click', onClick);
	return btn;
}
