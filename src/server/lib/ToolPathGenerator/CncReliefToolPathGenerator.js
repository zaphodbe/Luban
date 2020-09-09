import Jimp from 'jimp';
import EventEmitter from 'events';
// import GcodeParser from './GcodeParser';
import Normalizer from './Normalizer';
import ToolPath from '../ToolPath';

const OVERLAP_RATE = 0.5;
const MAX_DENSITY = 20;

export default class CncReliefToolPathGenerator extends EventEmitter {
    constructor(modelInfo, modelPath) {
        super();
        // const { config, transformation, gcodeConfigPlaceholder } = modelInfo;
        const { config, transformation, gcodeConfig, isRotate, diameter } = modelInfo;
        const { jogSpeed, workSpeed, plungeSpeed, toolDiameter, toolAngle, targetDepth,
            stepDown, safetyHeight, stopHeight, density, isModel = false } = gcodeConfig;

        const { invert } = config;

        const initialZ = isRotate ? diameter / 2 : 0;

        this.modelInfo = modelInfo;
        this.jogSpeed = jogSpeed;
        this.workSpeed = workSpeed;
        this.plungeSpeed = plungeSpeed;

        this.initialZ = initialZ;
        this.targetDepth = targetDepth;
        this.stepDown = stepDown;
        this.safetyHeight = initialZ + safetyHeight;
        this.stopHeight = initialZ + stopHeight;
        this.finalDepth = this.initialZ - this.targetDepth;

        this.isRotate = isRotate;
        this.diameter = diameter;
        this.toolPath = new ToolPath({ isRotate, radius: isModel ? transformation.width / Math.PI / 2 : this.diameter / 2 });

        const maxDensity = this.calMaxDensity(toolDiameter, transformation);
        this.density = Math.min(density, maxDensity);

        this.isModel = isModel;

        this.transformation = transformation;

        this.imageDiameter = this.isModel ? transformation.width / Math.PI : 0;


        this.targetWidth = Math.round(transformation.width * this.density);
        this.targetHeight = Math.round(transformation.height * this.density);
        this.rotationZ = transformation.rotationZ;
        this.flip = transformation.flip;
        this.invert = invert;

        this.modelPath = modelPath;
        this.toolSlope = Math.tan(toolAngle / 2 * Math.PI / 180);
    }

    _processImage() {
        let data = null;
        return Jimp
            .read(this.modelPath)
            .then(img => {
                if (this.invert) {
                    img.invert();
                }

                const { width, height } = img.bitmap;

                img
                    .greyscale()
                    .flip((this.flip & 2) > 0, (this.flip & 1) > 0)
                    .rotate(-this.rotationZ * 180 / Math.PI)
                    .background(0xffffffff);

                // targetWidth&targetHeight will be changed after rotated
                this.targetWidth = Math.round(this.targetWidth * img.bitmap.width / width);
                this.targetHeight = Math.round(this.targetHeight * img.bitmap.height / height);

                data = [];
                for (let i = 0; i < this.targetWidth; i++) {
                    data[i] = [];
                    for (let j = 0; j < this.targetHeight; j++) {
                        const x = Math.floor(i / this.targetWidth * img.bitmap.width);
                        const y = Math.floor(j / this.targetHeight * img.bitmap.height);
                        const idx = y * img.bitmap.width * 4 + x * 4;
                        data[i][j] = img.bitmap.data[idx];
                    }
                }

                let smooth = false;
                while (!smooth) {
                    smooth = !this.upSmooth(data);
                }
                return data;
            });
    }

    /**
     * Calculate the max density
     */
    calMaxDensity(toolDiameter, transformation) {
        const maxDensity1 = Math.floor(Math.sqrt(5000000 / transformation.width / transformation.height));
        const lineWidth = toolDiameter * OVERLAP_RATE;
        const maxDensity2 = 1 / lineWidth;
        return Math.min(MAX_DENSITY, maxDensity1, maxDensity2);
    }

    calc(grey) {
        // return (color / 255 * this.targetDepth - 1 / this.density / this.toolSlope) * 255 / this.targetDepth;
        return grey - 255 / (this.targetDepth * this.density * this.toolSlope);
    }

    upSmooth = (data) => {
        const width = data.length;
        const height = data[0].length;
        const depthOffsetRatio = this.targetDepth * this.density * this.toolSlope;
        let updated = false;
        const dx = [-1, -1, -1, 0, 0, 1, 1, 1];
        const dy = [-1, 0, 1, -1, 1, -1, 0, 1];
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                let allowedDepth = 0;
                if (depthOffsetRatio < 255) {
                    for (let k = 0; k < 8; k++) {
                        const i2 = i + dx[k];
                        const j2 = j + dy[k];
                        if (i2 < 0 || i2 > width - 1 || j2 < 0 || j2 > height - 1) {
                            continue;
                        }
                        allowedDepth = Math.max(allowedDepth, data[i2][j2]);
                    }
                    allowedDepth = this.calc(allowedDepth);
                }
                if (data[i][j] < allowedDepth) {
                    data[i][j] = allowedDepth;
                    updated = true;
                }
            }
        }
        return updated;
    };

    _calculateThePrintZ(pixel) {
        if (this.isRotate && this.isModel) {
            const imageRadius = this.imageDiameter / 2;
            const d = this.diameter / 2 - imageRadius;
            return this.initialZ - d + Math.round(-pixel * imageRadius / 255 * 100) / 100;
        } else {
            return this.initialZ + Math.round(-pixel * this.targetDepth / 255 * 100) / 100;
        }
    }

    parseRotateImageToViewPathObj = (data) => {
        const stepOver = 1 / this.density;

        const normalizer = new Normalizer(
            'Center',
            0,
            this.targetWidth,
            0,
            this.targetHeight,
            { x: 1 / this.density, y: 1 / this.density },
            { x: this.isRotate ? this.transformation.positionX : 0, y: 0 }
        );

        const paths = [];
        const circumference = (this.isModel ? this.imageDiameter : this.diameter) * Math.PI;
        const length = Math.floor(circumference * this.density);

        for (let j = 0; j < this.targetHeight; j++) {
            const path = [];
            for (let i = 0; i < this.targetWidth; i++) {
                const viewX = normalizer.x(i);
                // const z = this.initialZ + Math.round(-data[i][j] * this.targetDepth / 255 * 100) / 100;
                const z = this._calculateThePrintZ(data[i][j]);
                const index = (Math.round(viewX / circumference * length) % length + length) % length;
                path[index] = path[index] ? Math.min(path[index], z) : z;
            }
            paths.push(path);
        }

        for (const path of paths) {
            for (let i = 0; i < length; i++) {
                const b = i / length * 360 / 180 * Math.PI;
                const z = path[i] ? path[i] : this.diameter / 2;
                const x = z * Math.sin(b);
                const y = z * Math.cos(b);
                path[i] = { x: x, y: y };
            }
            path.push(path[0]);
        }

        const boundingBox = {
            max: {
                x: this.transformation.positionX + this.targetWidth / this.density / 2,
                y: this.transformation.positionY + this.targetHeight / this.density / 2,
                z: -this.targetDepth
            },
            min: {
                x: this.transformation.positionX - this.targetWidth / this.density / 2,
                y: this.transformation.positionY - this.targetHeight / this.density / 2,
                z: 0
            },
            length: {
                x: this.targetWidth / this.density,
                y: this.targetHeight / this.density,
                z: this.targetDepth
            }
        };

        return {
            stepOver: stepOver,
            direction: 'Y',
            depth: stepOver,
            initZ: -boundingBox.length.y / 2,
            stopOver: stepOver,
            data: paths,
            positionX: 0,
            positionY: this.transformation.positionY,
            rotationX: Math.PI / 2,
            boundingBox: boundingBox,
            isRotate: this.isRotate
        };
    };

    parseImageToViewPathObj = (data) => {
        const { positionX, positionY } = this.transformation;

        const stepOver = 1 / this.density;

        const normalizer = new Normalizer(
            'Center',
            0,
            this.targetWidth,
            0,
            this.targetHeight,
            { x: 1 / this.density, y: 1 / this.density },
            { x: this.isRotate ? positionX : 0, y: 0 }
        );

        const paths = [];

        for (let j = 0; j < this.targetHeight; j++) {
            const path = [];
            for (let i = 0; i < this.targetWidth; i++) {
                const viewX = normalizer.x(i);
                const z = this.initialZ + Math.round(-data[i][j] * this.targetDepth / 255 * 100) / 100;
                if (i === 0) {
                    path.push({ x: viewX, y: -this.targetDepth });
                }
                if (path.length >= 2 && z === path[path.length - 1].y && z === path[path.length - 2].y) {
                    path[path.length - 1].x = viewX;
                } else {
                    path.push({ x: viewX, y: z });
                }
                if (i === this.targetWidth - 1) {
                    path.push({ x: viewX, y: -this.targetDepth });
                }
            }
            path.push(path[0]);
            paths.push(path);
        }

        const boundingBox = {
            max: {
                x: positionX + this.targetWidth / this.density / 2,
                y: positionY + this.targetHeight / this.density / 2,
                z: -this.targetDepth
            },
            min: {
                x: positionX - this.targetWidth / this.density / 2,
                y: positionY - this.targetHeight / this.density / 2,
                z: 0
            },
            length: {
                x: this.targetWidth / this.density,
                y: this.targetHeight / this.density,
                z: this.targetDepth
            }
        };

        return {
            stepOver: stepOver,
            direction: 'Y',
            depth: stepOver,
            initZ: -boundingBox.length.y / 2,
            stopOver: stepOver,
            data: paths,
            positionX: positionX,
            positionY: positionY,
            rotationX: Math.PI / 2,
            boundingBox: boundingBox,
            isRotate: this.isRotate
        };
    };

    parseImageToToolPathObj = (data) => {
        let cutDown = true;
        let curDepth = this.initialZ - this.stepDown;
        let currentZ = this.initialZ;
        let progress = 0;
        let cutDownTimes = 0;
        const { positionX, positionY, positionZ } = this.transformation;
        const normalizer = new Normalizer(
            'Center',
            0,
            this.targetWidth,
            0,
            this.targetHeight,
            { x: 1 / this.density, y: 1 / this.density },
            { x: this.isRotate ? positionX : 0, y: 0 }
        );

        const normalizedX0 = normalizer.x(0);
        const normalizedHeight = normalizer.y(this.targetHeight);
        const zSteps = Math.ceil(this.targetDepth / this.stepDown) + 1;

        this.toolPath.safeStart(normalizedX0, normalizedHeight, this.stopHeight, this.safetyHeight);

        this.toolPath.spindleOn();

        const move0Z = (zState) => {
            if (zState) {
                const lastCommand = this.toolPath.getLastCommand();
                if (lastCommand.G !== 0 || lastCommand.Z < zState.z) {
                    this.toolPath.move0Z(zState.maxZ, zState.f);
                }
                this.toolPath.move0XY(zState.x, zState.y, zState.f);
                this.toolPath.move0Z(zState.z, zState.f);
            }
        };

        const zMin = [];

        for (let i = 0; i < data.length; i++) {
            zMin[i] = 0;
            for (let j = 0; j < data[i].length; j++) {
                const z = this._calculateThePrintZ(data[i][j]);
                data[i][j] = z;
                zMin[i] = Math.min(zMin[i], z);
            }
        }

        while (cutDown) {
            cutDown = false;
            let isOrder = false;

            for (let i = 0; i < this.targetWidth; ++i) {
                const gX = normalizer.x(i);

                let zState = null;

                if (zMin[i] >= curDepth + this.stepDown) {
                    continue;
                }

                isOrder = !isOrder;

                for (let k = 0; k < this.targetHeight; ++k) {
                    const j = isOrder ? k : this.targetHeight - 1 - k;
                    const matY = (this.targetHeight - j);
                    const gY = normalizer.y(matY);

                    if (k === 0) {
                        this.toolPath.move0XY(gX, gY, this.jogSpeed);
                    }

                    let z = data[i][j];

                    if (z < curDepth + this.stepDown) {
                        move0Z(zState);

                        zState = null;
                        z = Math.max(curDepth, z);
                        if (currentZ === z) {
                            this.toolPath.move1Y(gY, this.workSpeed);
                        } else {
                            this.toolPath.move1YZ(gY, z, this.workSpeed);
                        }
                        currentZ = z;
                        cutDown = true;
                    } else {
                        if (!zState) {
                            zState = { x: gX, y: gY, z: z, maxZ: z, f: this.jogSpeed };
                        } else {
                            zState = { x: gX, y: gY, z: z, maxZ: Math.max(z, zState.maxZ), f: this.jogSpeed };
                        }
                    }
                }
                if (zState) {
                    zState.z = this.safetyHeight;
                    zState.maxZ = Math.max(zState.maxZ, this.safetyHeight);
                    move0Z(zState);
                } else {
                    this.toolPath.move0Z(this.safetyHeight, this.jogSpeed);
                }

                currentZ = this.safetyHeight;
                const p = i / (this.targetWidth - 1) / zSteps + cutDownTimes / zSteps;
                if (p - progress > 0.05) {
                    progress = p;
                    this.emit('progress', progress);
                }
            }
            this.toolPath.move0Z(this.safetyHeight, this.jogSpeed);
            this.toolPath.move0XY(normalizedX0, normalizedHeight, this.jogSpeed);

            currentZ = this.safetyHeight;
            curDepth = Math.round((curDepth - this.stepDown) * 100) / 100;

            if (curDepth < this.finalDepth) {
                break;
            }

            cutDownTimes += 1;
        }
        this.toolPath.move0Z(this.stopHeight, this.jogSpeed);
        this.toolPath.spindleOff();

        const boundingBox = this.toolPath.boundingBox;

        boundingBox.max.x += positionX;
        boundingBox.min.x += positionX;
        boundingBox.max.y += positionY;
        boundingBox.min.y += positionY;

        const { headType, mode, gcodeConfig } = this.modelInfo;

        return {
            headType: headType,
            mode: mode,
            movementMode: (headType === 'laser' && mode === 'greyscale') ? gcodeConfig.movementMode : '',
            data: this.toolPath.commands,
            estimatedTime: this.toolPath.estimatedTime * 1.6,
            positionX: positionX,
            positionY: positionY,
            positionZ: positionZ,
            boundingBox: boundingBox,
            isRotate: this.isRotate
        };
    };

    generateViewPathObj() {
        return this._processImage().then((data) => {
            return this.isRotate ? this.parseRotateImageToViewPathObj(data)
                : this.parseImageToViewPathObj(data);
        });
    }

    generateToolPathObj() {
        return this._processImage().then((data) => {
            return this.parseImageToToolPathObj(data);
        });
    }
}
