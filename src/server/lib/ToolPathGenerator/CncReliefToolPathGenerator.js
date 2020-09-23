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
        const { toolDiameter, toolAngle, targetDepth, stepDown, density, isModel = false } = gcodeConfig;

        const { invert } = config;

        this.modelInfo = modelInfo;
        this.modelPath = modelPath;

        this.gcodeConfig = gcodeConfig;

        this.initialZ = isRotate ? diameter / 2 : 0;
        this.targetDepth = targetDepth;
        this.finalDepth = this.initialZ - this.targetDepth;
        this.stepDown = stepDown;

        this.transformation = transformation;

        this.density = Math.min(density, this.calMaxDensity(toolDiameter, transformation));

        this.rotationZ = transformation.rotationZ;
        this.flip = transformation.flip;
        this.invert = invert;

        this.toolSlope = Math.tan(toolAngle / 2 * Math.PI / 180);

        this.isRotate = isRotate;
        this.diameter = diameter;
        this.isModel = isModel;

        const targetWidth = Math.round(transformation.width * this.density);
        const targetHeight = Math.round(transformation.height * this.density);

        this._initGenerator(targetWidth, targetHeight);
    }

    _initGenerator(targetWidth, targetHeight) {
        this.targetWidth = targetWidth;
        this.targetHeight = targetHeight;

        this.modelDiameter = this.targetWidth / this.density / Math.PI;

        this.toolPath = new ToolPath({ isRotate: this.isRotate, radius: this.isModel ? this.modelDiameter / 2 : this.diameter / 2 });

        this.normalizer = new Normalizer(
            'Center',
            0,
            this.targetWidth,
            0,
            this.targetHeight,
            { x: 1 / this.density, y: 1 / this.density },
            { x: 0, y: 0 }
        );
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
                const targetWidth = Math.round(this.targetWidth * img.bitmap.width / width);
                const targetHeight = Math.round(this.targetHeight * img.bitmap.height / height);

                this._initGenerator(targetWidth, targetHeight);

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
            const modelRadius = this.modelDiameter / 2;
            const d = this.diameter / 2 - modelRadius;
            return this.initialZ - d + Math.round(-pixel * modelRadius / 255 * 100) / 100;
        } else {
            return this.initialZ + Math.round(-pixel * this.targetDepth / 255 * 100) / 100;
        }
    }

    parseRotateImageToViewPathObj = (data) => {
        const normalizer = this.normalizer;

        const paths = [];

        const pathLength = this.isModel ? this.targetWidth : Math.round(this.diameter * Math.PI * this.density);

        for (let j = 0; j < this.targetHeight; j++) {
            const path = [];
            for (let i = 0; i < Math.max(this.targetWidth, pathLength); i++) {
                const index = i % pathLength;
                const x = normalizer.x(i);
                const z = i >= this.targetWidth ? this.diameter / 2 : this._calculateThePrintZ(data[i][j]);
                const b = this.toolPath.toB(x) / 180 * Math.PI;
                const px = z * Math.sin(b);
                const py = z * Math.cos(b);
                if (path[index] === undefined) {
                    path[index] = { x: px, y: py };
                } else {
                    if (px < path[index].px) {
                        path[index].px = px;
                        path[index].py = px;
                    }
                }
            }
            path.push(path[0]);
            paths.push(path);
        }

        paths.push(paths[paths.length - 1]);

        const boundingBox = {
            max: {
                x: this.transformation.positionX + this.transformation.width / 2,
                y: this.transformation.positionY + this.transformation.height / 2,
                z: -this.targetDepth
            },
            min: {
                x: this.transformation.positionX - this.transformation.width / 2,
                y: this.transformation.positionY - this.transformation.height / 2,
                z: 0
            },
            length: {
                x: this.transformation.width,
                y: this.transformation.height,
                z: this.targetDepth
            }
        };

        return {
            data: paths,
            positionX: 0,
            positionY: this.transformation.positionY,
            rotationB: this.isRotate ? this.toolPath.toB(this.transformation.positionX) : 0,
            width: this.transformation.width,
            height: this.transformation.height,
            boundingBox: boundingBox,
            isRotate: this.isRotate,
            diameter: this.diameter
        };
    };

    parseImageToViewPathObj = (data) => {
        const { positionX, positionY } = this.transformation;

        const normalizer = this.normalizer;

        const paths = [];

        for (let j = 0; j < this.targetHeight; j++) {
            const path = [];
            for (let i = 0; i < this.targetWidth; i++) {
                const x = normalizer.x(i);
                const z = this._calculateThePrintZ(data[i][j]);
                path.push({ x: x, y: z });
            }
            paths.push(path);
        }

        const boundingBox = {
            max: {
                x: this.transformation.positionX + this.transformation.width / 2,
                y: this.transformation.positionY + this.transformation.height / 2,
                z: -this.targetDepth
            },
            min: {
                x: this.transformation.positionX - this.transformation.width / 2,
                y: this.transformation.positionY - this.transformation.height / 2,
                z: 0
            },
            length: {
                x: this.transformation.width,
                y: this.transformation.height,
                z: this.targetDepth
            }
        };

        return {
            data: paths,
            width: this.transformation.width,
            height: this.transformation.height,
            targetDepth: this.targetDepth,
            positionX: positionX,
            positionY: positionY,
            boundingBox: boundingBox
        };
    };

    parseImageToToolPathObj = (data) => {
        const { jogSpeed, workSpeed } = this.gcodeConfig;
        let { safetyHeight, stopHeight } = this.gcodeConfig;

        safetyHeight = this.initialZ + safetyHeight;
        stopHeight = this.initialZ + stopHeight;

        let cutDown = true;
        let curDepth = this.initialZ - this.stepDown;
        let currentZ = this.initialZ;
        let progress = 0;
        let cutDownTimes = 0;

        const normalizer = this.normalizer;

        const normalizedX0 = normalizer.x(0);
        const normalizedHeight = normalizer.y(this.targetHeight);
        const zSteps = Math.ceil(this.targetDepth / this.stepDown) + 1;

        this.toolPath.safeStart(normalizedX0, normalizedHeight, stopHeight, safetyHeight);

        this.toolPath.spindleOn({ P: 100 });

        const move0Z = (zState) => {
            if (zState) {
                const lastCommand = this.toolPath.getLastCommand();
                if (lastCommand.G !== 0 || lastCommand.Z < zState.maxZ) {
                    this.toolPath.move0Z(zState.maxZ, zState.f);
                }
                this.toolPath.move0XY(zState.x, zState.y, zState.f);
                this.toolPath.move0Z(zState.z, zState.f);
            }
        };

        const zMin = [];

        for (let j = 0; j < this.targetHeight; j++) {
            zMin[j] = this.initialZ;
            for (let i = 0; i < this.targetWidth; i++) {
                const z = this._calculateThePrintZ(data[i][j]);
                data[i][j] = z;
                zMin[j] = Math.min(zMin[j], z);
            }
        }

        while (cutDown) {
            cutDown = false;
            let isOrder = false;

            for (let j = 0; j < this.targetHeight; j++) {
                const gY = normalizer.y(this.targetHeight - 1 - j);

                let zState = null;

                if (zMin[j] >= curDepth + this.stepDown) {
                    continue;
                }

                isOrder = !isOrder;

                for (let k = 0; k < this.targetWidth; k++) {
                    const i = isOrder ? k : this.targetWidth - 1 - k;
                    const gX = normalizer.x(i);

                    let z = data[i][j];

                    if (k === 0) {
                        this.toolPath.move0XY(gX, gY, jogSpeed);
                    }

                    if (z < curDepth + this.stepDown) {
                        move0Z(zState);

                        zState = null;
                        z = Math.max(curDepth, z);
                        if (currentZ === z) {
                            this.toolPath.move1X(gX, workSpeed);
                        } else {
                            this.toolPath.move1XZ(gX, z, workSpeed);
                        }
                        currentZ = z;
                        cutDown = true;
                    } else {
                        if (!zState) {
                            zState = { x: gX, y: gY, z: z, maxZ: z, f: jogSpeed };
                        } else {
                            zState = { x: gX, y: gY, z: z, maxZ: Math.max(z, zState.maxZ), f: jogSpeed };
                        }
                    }
                }

                if (zState) {
                    zState.z = this.initialZ;
                    zState.maxZ = Math.max(zState.maxZ, this.initialZ);
                    move0Z(zState);
                } else {
                    this.toolPath.move0Z(this.initialZ, jogSpeed);
                }

                currentZ = this.initialZ;

                const p = j / (this.targetHeight - 1) / zSteps + cutDownTimes / zSteps;
                if (p - progress > 0.05) {
                    progress = p;
                    this.emit('progress', progress);
                }
            }
            this.toolPath.move0Z(safetyHeight, jogSpeed);
            this.toolPath.move0XY(normalizedX0, normalizedHeight, jogSpeed);

            currentZ = safetyHeight;
            curDepth = Math.round((curDepth - this.stepDown) * 100) / 100;

            if (curDepth < this.finalDepth) {
                break;
            }

            cutDownTimes += 1;
        }
        this.toolPath.move0Z(stopHeight, jogSpeed);
        this.toolPath.spindleOff();

        const boundingBox = this.toolPath.boundingBox;

        boundingBox.max.x += this.transformation.positionX;
        boundingBox.min.x += this.transformation.positionX;
        boundingBox.max.y += this.transformation.positionY;
        boundingBox.min.y += this.transformation.positionY;

        const { headType, mode, gcodeConfig } = this.modelInfo;

        return {
            headType: headType,
            mode: mode,
            movementMode: (headType === 'laser' && mode === 'greyscale') ? gcodeConfig.movementMode : '',
            data: this.toolPath.commands,
            estimatedTime: this.toolPath.estimatedTime * 1.6,
            positionX: this.isRotate ? 0 : this.transformation.positionX,
            positionY: this.transformation.positionY,
            positionZ: this.transformation.positionZ,
            rotationB: this.isRotate ? this.toolPath.toB(this.transformation.positionX) : 0,
            boundingBox: boundingBox,
            isRotate: this.isRotate,
            diameter: this.diameter
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
