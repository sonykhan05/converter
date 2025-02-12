document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const imageInfo = document.getElementById('imageInfo');
    const conversionOptions = document.getElementById('conversionOptions');
    const formatButtons = document.querySelectorAll('.format-btn');
    const convertBtn = document.getElementById('convertBtn');
    const downloadSection = document.getElementById('downloadSection');
    const downloadBtn = document.getElementById('downloadBtn');
    const qualitySlider = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    const resizeSelect = document.getElementById('resize');
    const customSize = document.getElementById('customSize');
    const widthInput = document.getElementById('width');
    const heightInput = document.getElementById('height');
    
    let selectedFile = null;
    let selectedFormat = null;
    let convertedFile = null;

    // Quality slider
    qualitySlider.addEventListener('input', (e) => {
        qualityValue.textContent = `${e.target.value}%`;
    });

    // Resize select
    resizeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customSize.style.display = 'block';
        } else {
            customSize.style.display = 'none';
        }
    });

    // Reset conversion state
    function resetConversionState() {
        downloadSection.style.display = 'none';
        convertedFile = null;
    }

    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('highlight');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('highlight');
        });
    });

    dropZone.addEventListener('drop', handleDrop);
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files.length > 0) {
            selectedFile = files[0];
            if (!selectedFile.type.startsWith('image/')) {
                alert('Please upload an image file.');
                return;
            }
            resetConversionState();
            displayPreview();
        }
    }

    function displayPreview() {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imageInfo.textContent = `File: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`;
            conversionOptions.style.display = 'block';
        };
        reader.readAsDataURL(selectedFile);
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Format selection
    formatButtons.forEach(button => {
        button.addEventListener('click', () => {
            formatButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedFormat = button.getAttribute('data-format');
            resetConversionState();
            
            // Show/hide SVG settings
            const svgSettings = document.getElementById('svgSettings');
            svgSettings.style.display = selectedFormat === 'svg' ? 'block' : 'none';
        });
    });

    // Convert image
    convertBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            alert('Please select an image first.');
            return;
        }
        if (!selectedFormat) {
            alert('Please select a format to convert to.');
            return;
        }

        convertBtn.disabled = true;
        convertBtn.innerHTML = '<i class="fas fa-spinner"></i> Converting...';
        convertBtn.classList.add('converting');
        downloadSection.style.display = 'none';
        
        try {
            convertedFile = await convertImage();
            downloadSection.style.display = 'block';
            // Scroll to download section
            downloadSection.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            alert('Error converting image: ' + error.message);
        } finally {
            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i class="fas fa-magic"></i> Convert Image';
            convertBtn.classList.remove('converting');
        }
    });

    // Download converted file
    downloadBtn.addEventListener('click', () => {
        if (convertedFile) {
            const link = document.createElement('a');
            link.href = convertedFile.url;
            link.download = convertedFile.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });

    async function convertImage() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        return new Promise((resolve, reject) => {
            img.onload = async () => {
                // Handle resize
                let width = img.width;
                let height = img.height;
                
                const resizeOption = resizeSelect.value;
                if (resizeOption !== 'original') {
                    if (resizeOption === 'custom') {
                        width = parseInt(widthInput.value) || width;
                        height = parseInt(heightInput.value) || height;
                    } else {
                        const sizes = {
                            small: [800, 600],
                            medium: [1024, 768],
                            large: [1920, 1080]
                        };
                        [width, height] = sizes[resizeOption];
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                try {
                    if (selectedFormat === 'pdf') {
                        // Convert to PDF
                        const { jsPDF } = window.jspdf;
                        const pdf = new jsPDF({
                            orientation: width > height ? 'landscape' : 'portrait',
                            unit: 'px',
                            format: [width, height]
                        });
                        
                        const imgData = canvas.toDataURL('image/jpeg', qualitySlider.value / 100);
                        pdf.addImage(
                            imgData,
                            'JPEG',
                            0,
                            0,
                            width,
                            height
                        );
                        
                        const pdfBlob = pdf.output('blob');
                        resolve({
                            url: URL.createObjectURL(pdfBlob),
                            filename: `converted-image.pdf`
                        });
                    } else if (selectedFormat === 'svg') {
                        // Convert to SVG using Potrace
                        const svgDetail = document.getElementById('svgDetail').value;
                        const imageData = ctx.getImageData(0, 0, width, height);
                        
                        // Convert to black and white for better tracing
                        const pixels = imageData.data;
                        for (let i = 0; i < pixels.length; i += 4) {
                            const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
                            pixels[i] = pixels[i + 1] = pixels[i + 2] = brightness;
                        }
                        ctx.putImageData(imageData, 0, 0);

                        // Configure Potrace settings based on detail level
                        const potraceSettings = {
                            turdSize: svgDetail === 'low' ? 100 : svgDetail === 'medium' ? 50 : 25,
                            alphaMax: svgDetail === 'low' ? 0.5 : svgDetail === 'medium' ? 1 : 2,
                            optCurve: true,
                            optTolerance: svgDetail === 'low' ? 0.8 : svgDetail === 'medium' ? 0.4 : 0.2
                        };

                        // Trace the image
                        const trace = new Potrace(potraceSettings);
                        trace.loadImageFromCanvas(canvas);
                        
                        const svgData = trace.getSVG();
                        const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
                        resolve({
                            url: URL.createObjectURL(svgBlob),
                            filename: 'converted-image.svg'
                        });
                    } else if (selectedFormat === 'psd') {
                        // Convert to PSD using ag-psd
                        const imageData = ctx.getImageData(0, 0, width, height);
                        
                        // Create PSD file structure
                        const psd = {
                            width: width,
                            height: height,
                            channels: 4, // RGBA
                            bitsPerChannel: 8,
                            colorMode: 3, // RGB
                            children: [{
                                name: 'Image Layer',
                                opacity: 255,
                                visible: true,
                                canvas: canvas
                            }]
                        };

                        // Convert to PSD binary data
                        const psdData = agPsd.writePsd(psd);
                        const psdBlob = new Blob([psdData], { type: 'image/vnd.adobe.photoshop' });
                        
                        resolve({
                            url: URL.createObjectURL(psdBlob),
                            filename: 'converted-image.psd'
                        });
                    } else {
                        // Convert to other formats
                        let mimeType;
                        switch (selectedFormat) {
                            case 'png': mimeType = 'image/png'; break;
                            case 'jpg': mimeType = 'image/jpeg'; break;
                            case 'webp': mimeType = 'image/webp'; break;
                            case 'gif': mimeType = 'image/gif'; break;
                            case 'bmp': mimeType = 'image/bmp'; break;
                            case 'ico': mimeType = 'image/x-icon'; break;
                            case 'tiff': mimeType = 'image/tiff'; break;
                            default: throw new Error('Unsupported format');
                        }

                        canvas.toBlob((blob) => {
                            resolve({
                                url: URL.createObjectURL(blob),
                                filename: `converted-image.${selectedFormat}`
                            });
                        }, mimeType, qualitySlider.value / 100);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imagePreview.src;
        });
    }
});
