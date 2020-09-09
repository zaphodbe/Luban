import * as THREE from 'three';

export class ViewPathRenderer {
    render(viewPaths, size) {
        const objs = this._generateViewPathObjs(viewPaths);
        const background = this._generateBackground(viewPaths, size);

        const g = new THREE.Group();
        g.add(background);
        g.add(objs);

        return g;
    }

    _generateViewPathObjs(viewPaths) {
        const group = new THREE.Group();
        for (const viewPath of viewPaths.data) {
            const viewPathGroup = new THREE.Group();

            const { boundingBox, depth = 1, initZ = 0, stepOver = 0 } = viewPath;

            for (let i = 0; i < viewPath.data.length; i++) {
                const shape = new THREE.Shape(viewPath.data[i]);

                const mesh = this._generateMesh(shape, depth);
                mesh.position.z = initZ + stepOver * i;

                viewPathGroup.add(mesh);
            }
            if (viewPath.positionX) {
                viewPathGroup.position.x = viewPath.positionX;
            }
            if (viewPath.positionY) {
                viewPathGroup.position.y = viewPath.positionY;
            }
            if (viewPath.rotationX) {
                viewPathGroup.rotation.x = viewPath.rotationX;
            }
            if (viewPath.rotationY) {
                viewPathGroup.rotation.Y = viewPath.rotationY;
            }

            const boxPoints = this._generateByBox(boundingBox.min, boundingBox.max);
            const boxMesh = this._generateMesh(new THREE.Shape(boxPoints), viewPaths.targetDepth - boundingBox.length.z);
            boxMesh.position.z = -viewPaths.targetDepth;

            group.add(viewPathGroup);
            if (!viewPaths.isRotate) {
                group.add(boxMesh);
            }
        }

        return group;
    }

    _generateBackground(viewPaths, size) {
        const group = new THREE.Group();
        if (viewPaths.isRotate) {
            let start = -size.y;
            const holes = viewPaths.holes;
            for (const hole of holes) {
                if (hole.min > start) {
                    const geometry = new THREE.CylinderGeometry(viewPaths.diameter / 2, viewPaths.diameter / 2, hole.min - start, 32);
                    const material = new THREE.MeshNormalMaterial();
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = (hole.min + start) / 2;
                    group.add(mesh);
                }
                start = hole.max;
            }
            if (size.y > start) {
                const geometry = new THREE.CylinderGeometry(viewPaths.diameter / 2, viewPaths.diameter / 2, size.y - start, 32);
                const material = new THREE.MeshNormalMaterial();
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = (size.y + start) / 2;
                group.add(mesh);
            }
        } else {
            const points = this._generateByBox({ x: -size.x, y: -size.y }, { x: size.x, y: size.y });

            const shape = new THREE.Shape(points);

            for (const hole of viewPaths.holes) {
                shape.holes.push(new THREE.Shape(hole));
            }

            const mesh = this._generateMesh(shape, viewPaths.targetDepth);
            mesh.position.z = -viewPaths.targetDepth;
            group.add(mesh);
        }
        return group;
    }

    _generateByBox(min, max) {
        return [
            { x: min.x, y: min.y },
            { x: max.x, y: min.y },
            { x: max.x, y: max.y },
            { x: min.x, y: max.y },
            { x: min.x, y: min.y }
        ];
    }

    _generateMesh(shapes, depth) {
        const geometry = new THREE.ExtrudeGeometry(shapes, {
            steps: 2,
            depth: depth,
            bevelEnabled: false
        });
        const material = new THREE.MeshNormalMaterial();
        return new THREE.Mesh(geometry, material);
    }
}
