import Jimp from 'jimp';
import { Mesh } from './Mesh';
import { Vector2 } from '../math/Vector2';
import { PLANE_XY } from '../../constants';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import DataStorage from '../../DataStorage';
import { isZero } from '../../../shared/lib/utils';
import { Line, TYPE_SEGMENT } from '../math/Line';
import { Slicer } from './Slicer';

/**
 * Calculate whether a point is inside the triangle
 * @returns {*}
 */
function pointInTriangle(v0, v1, v2, p) {
    return Vector2.sameSide(v0, v1, p, v2) && Vector2.sameSide(v1, v2, p, v0) && Vector2.sameSide(v2, v0, p, v1);
}

/**
 * Get the plane function through 3 points
 * Ax + by + cz + d = 0
 * @returns {{A: number, B: number, C: number, D: number}}
 */
function getPlane(v0, v1, v2) {
    const A = ((v1.y - v0.y) * (v2.z - v0.z) - (v1.z - v0.z) * (v2.y - v0.y));
    const B = ((v1.z - v0.z) * (v2.x - v0.x) - (v1.x - v0.x) * (v2.z - v0.z));
    const C = ((v1.x - v0.x) * (v2.y - v0.y) - (v1.y - v0.y) * (v2.x - v0.x));
    const D = (0 - (A * v0.x + B * v0.y + C * v0.z));
    return {
        A, B, C, D
    };
}

function getAngleRange(angle1, angle2, angle = 1) {
    const order = Math.abs(angle1 - angle2) < 180;
    let start, end;
    if (angle1 < angle2) {
        start = order ? angle1 : angle2;
        end = order ? angle2 : angle1 + 360;
    } else {
        start = order ? angle2 : angle1;
        end = order ? angle1 : angle2 + 360;
    }
    start = Math.ceil(start / angle);
    end = Math.floor(end / angle);

    return {
        start,
        end
    };
}

const getPointByLineAndAngle = (start, end, angle) => {
    const k2 = Math.tan(angle / 180 * Math.PI);
    if (start.x === end.x) {
        return {
            x: start.x,
            y: k2 * start.x
        };
    }
    if (start.y === end.y) {
        return {
            x: start.y / k2,
            y: start.y
        };
    }
    const k1 = (end.y - start.y) / (end.x - start.x);
    const b1 = end.y - k1 * end.x;
    if (k1 === k2) {
        return null;
    }
    return {
        x: b1 / (k2 - k1),
        y: (b1 / (k2 - k1)) * k2
    };
};

export class MeshProcess {
    constructor(modelInfo) {
        const { uploadName, config = {}, isRotate, diameter } = modelInfo;
        const { plane = PLANE_XY, minGray = 0, maxGray = 255,
            sliceDensity = 5, extensionX = 0, extensionY = 0 } = config;

        this.uploadName = uploadName;
        this.plane = plane;
        this.minGray = minGray;
        this.maxGray = maxGray;
        this.extensionX = extensionX;
        this.extensionY = extensionY;
        this.sliceDensity = sliceDensity;

        this.isRotate = isRotate;
        this.diameter = diameter;

        this.outputFilename = pathWithRandomSuffix(this.uploadName).replace('.stl', '.jpg');

        this.mesh = Mesh.loadSTLFile(`${DataStorage.tmpDir}/${uploadName}`, this.plane);
        if (!this.mesh) {
            throw new Error(`MeshProcess load uploadName: ${uploadName} failed`);
        }
    }

    convertTo3AxisImage() {
        const mesh = this.mesh;

        mesh.offset({
            x: -mesh.aabb.min.x,
            y: -mesh.aabb.min.y,
            z: -mesh.aabb.min.z
        });

        const data = [];

        for (const face of mesh.faces) {
            const v0 = mesh.vertices[face.vertexIndex[0]].p;
            const v1 = mesh.vertices[face.vertexIndex[1]].p;
            const v2 = mesh.vertices[face.vertexIndex[2]].p;
            const box = {
                max: {
                    x: Math.max(v0.x, v1.x, v2.x),
                    y: Math.max(v0.y, v1.y, v2.y),
                    z: Math.max(v0.z, v1.z, v2.z)
                },
                min: {
                    x: Math.min(v0.x, v1.x, v2.x),
                    y: Math.min(v0.y, v1.y, v2.y),
                    z: Math.min(v0.z, v1.z, v2.z)
                }
            };

            const wStart = Math.ceil(box.min.x * this.sliceDensity);
            const wEnd = Math.floor(box.max.x * this.sliceDensity);
            const hStart = Math.ceil(box.min.y * this.sliceDensity);
            const hEnd = Math.floor(box.max.y * this.sliceDensity);

            for (let i = wStart; i <= wEnd; i++) {
                for (let j = hStart; j <= hEnd; j++) {
                    if (!data[i]) {
                        data[i] = [];
                    }
                    const p = {
                        x: i / this.sliceDensity,
                        y: j / this.sliceDensity
                    };
                    if (pointInTriangle(v0, v1, v2, p)) {
                        const plane = getPlane(v0, v1, v2);
                        let z;
                        if (isZero(plane.C)) {
                            const v2d0 = isZero(plane.B) ? { x: v0.y, y: v0.z } : { x: v0.x, y: v0.z };
                            const v2d1 = isZero(plane.B) ? { x: v1.y, y: v1.z } : { x: v1.x, y: v1.z };
                            const v2d2 = isZero(plane.B) ? { x: v2.y, y: v2.z } : { x: v2.x, y: v2.z };
                            const p2d0 = isZero(plane.B) ? { x: p.y, y: 1 } : { x: p.x, y: 1 };
                            const p2d1 = isZero(plane.B) ? { x: p.y, y: 0 } : { x: p.x, y: 0 };
                            const r1 = Line.intersectionPoint(new Line(v2d0, v2d1, TYPE_SEGMENT), new Line(p2d0, p2d1));
                            const r2 = Line.intersectionPoint(new Line(v2d1, v2d2, TYPE_SEGMENT), new Line(p2d0, p2d1));
                            const r3 = Line.intersectionPoint(new Line(v2d2, v2d0, TYPE_SEGMENT), new Line(p2d0, p2d1));
                            z = r1 && r1.y;
                            z = r2 && Math.max(z, r2.y);
                            z = r3 && Math.max(z, r3.y);
                        } else {
                            z = -(plane.A * i + plane.B * j + plane.D) / plane.C;
                        }
                        data[i][j] = data[i][j] === undefined ? z : Math.max(z, data[i][j]);
                    }
                }
            }
        }

        const width = Math.round(mesh.aabb.length.x * this.sliceDensity) + 2 * this.extensionX;
        const height = Math.round(mesh.aabb.length.y * this.sliceDensity) + 2 * this.extensionY;

        const maxZ = mesh.aabb.length.z;
        const grayRange = this.maxGray - this.minGray;

        return new Promise(resolve => {
            // eslint-disable-next-line no-new
            new Jimp(width, height, (err, image) => {
                for (let i = 0; i < width; i++) {
                    for (let j = 0; j < height; j++) {
                        const ii = i - this.extensionX;
                        const jj = j - this.extensionY;
                        const idx = jj * width * 4 + ii * 4;
                        let d = data[ii] && data[ii][jj] ? data[ii][jj] / maxZ * grayRange + this.minGray : 0;
                        d = 255 - d;

                        image.bitmap.data[idx] = d;
                        image.bitmap.data[idx + 1] = d;
                        image.bitmap.data[idx + 2] = d;
                        image.bitmap.data[idx + 3] = 255;
                    }
                }

                image.write(`${DataStorage.tmpDir}/${this.outputFilename}`, () => {
                    resolve({
                        filename: this.outputFilename
                    });
                });
            });
        });
    }

    convertTo4AxisImage() {
        const mesh = this.mesh;

        mesh.offset({
            x: -(mesh.aabb.max.x + mesh.aabb.min.x) / 2,
            y: -(mesh.aabb.max.y + mesh.aabb.min.y) / 2,
            z: -mesh.aabb.min.z
        });

        const height = Math.ceil(mesh.aabb.length.z * this.sliceDensity);
        const initialLayerThickness = 1 / this.sliceDensity;
        const layerThickness = 1 / this.sliceDensity;

        const slicer = new Slicer(this.mesh, layerThickness, height, initialLayerThickness);

        const data = [];
        const r = Vector2.length({ x: mesh.aabb.length.x / 2, y: mesh.aabb.length.y / 2 });
        const width = Math.ceil(r * 2 * Math.PI * this.sliceDensity);
        // const width = 360;
        const sliceAngle = 360 / width;

        let maxR = 0;

        for (let i = 0; i < slicer.slicerLayers.length; i++) {
            data[i] = [];
            const slicerLayer = slicer.slicerLayers[i];
            for (const ppath of slicerLayer.polygons.paths) {
                for (let j = 0; j < ppath.length; j++) {
                    const start = ppath[j % ppath.length];
                    const end = ppath[(j + 1) % ppath.length];

                    maxR = Math.max(Vector2.length2(start), Vector2.length2(end), maxR);

                    const a1 = Vector2.angle(start);
                    const a2 = Vector2.angle(end);
                    if (!a1 || !a2 || Math.abs(a1 - a2) === 180) {
                        continue;
                    }
                    const range = getAngleRange(a1, a2, sliceAngle);
                    for (let a = range.start; a <= range.end; a++) {
                        const aa = (a * sliceAngle) % 360;
                        const hj = Math.round(aa / sliceAngle);

                        const p = getPointByLineAndAngle(start, end, aa);
                        if (!data[i][hj]) {
                            data[i][hj] = [];
                        }

                        if (!data[i][hj][0]) {
                            data[i][hj][0] = (Vector2.length(p));
                        }

                        data[i][hj][0] = Math.max(Vector2.length(p), data[i][hj][0]);
                    }
                }
            }
        }

        maxR = Math.sqrt(maxR);

        return new Promise(resolve => {
            // eslint-disable-next-line no-new
            new Jimp(width, height, (err, image) => {
                for (let i = 0; i < width; i++) {
                    for (let j = 0; j < height; j++) {
                        const idx = j * width * 4 + i * 4;
                        let d = data[j][i] ? data[j][i][0] / maxR * 255 : 0;
                        d = 255 - d;

                        image.bitmap.data[idx] = d;
                        image.bitmap.data[idx + 1] = d;
                        image.bitmap.data[idx + 2] = d;
                        image.bitmap.data[idx + 3] = 255;
                    }
                }
                image.write(`${DataStorage.tmpDir}/${this.outputFilename}`, () => {
                    resolve({
                        filename: this.outputFilename
                    });
                });
            });
        });
    }

    convertToImage() {
        if (this.isRotate) {
            return this.convertTo4AxisImage();
        } else {
            return this.convertTo3AxisImage();
        }
    }
}
