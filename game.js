import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { RapierPhysics } from "three/addons/physics/RapierPhysics.js"
import Stats from "three/addons/libs/stats.module"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

let container, width, height, camera, scene, renderer, stats
let physics, position
let spheres = []
let raycaster, mouse

init()

async function init() {
    physics = await RapierPhysics()
    position = new THREE.Vector3()

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(-1, 1.5, 2)
    camera.lookAt(0, 0.5, 0)

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0xbfd1e5)

    const dirLight = new THREE.DirectionalLight(0xffffff, 3)
    dirLight.position.set(5, 5, 5)
    dirLight.castShadow = true
    dirLight.shadow.camera.zoom = 2
    scene.add(dirLight)

    const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 10), new THREE.MeshPhongMaterial({ color: 0xffffff }))
    floor.position.y = -3.2
    floor.receiveShadow = true
    floor.userData.physics = { mass: 0 }
    scene.add(floor)

    const models = []
    const loader = new GLTFLoader()
    let modelTemplate

    try {
        const gltf = await loader.loadAsync("textured_mesh_glb.glb")
        modelTemplate = gltf.scene
        modelTemplate.scale.set(0.1, 0.1, 0.1)

        const modelPairs = []

        for (let i = 0; i < 50; i++) {
            let isOverlapping
            let randomX, randomZ

            do {
                isOverlapping = false
                randomX = Math.random() * 8 - 4
                randomZ = Math.random() * 8 - 6

                for (const model of models) {
                    const distance = Math.sqrt((model.position.x - randomX) ** 2 + (model.position.z - randomZ) ** 2)
                    if (distance < 0.5) {
                        isOverlapping = true
                        break
                    }
                }
            } while (isOverlapping)

            const model = modelTemplate.clone()
            model.position.set(randomX, 0, randomZ)
            model.receiveShadow = true
            model.castShadow = true

            const box = new THREE.Box3().setFromObject(model)
            const size = box.getSize(new THREE.Vector3())

            const physicsBox = new THREE.Mesh(new THREE.BoxGeometry(size.x * 1.5, size.y, size.z * 1.5), new THREE.MeshBasicMaterial({ visible: false }))
            physicsBox.position.copy(model.position)
            physicsBox.position.y += size.y / 2
            model.position.y += size.y / 2
            physicsBox.userData.physics = { mass: 1 }
            scene.add(physicsBox)

            scene.add(model)
            models.push(physicsBox)
            modelPairs.push({ model, physicsBox })
        }

        physics.addScene(scene)

        for (const physicsBox of models) {
            physics.addMesh(physicsBox)
            physics.setMeshPosition(physicsBox, physicsBox.position)
        }

        scene.userData.modelPairs = modelPairs
    } catch (error) {
        console.error("Error loading GLB model:", error)
    }

    container = document.body

    width = container.offsetWidth
    height = container.offsetHeight

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)

    stats = new Stats()
    document.body.appendChild(stats.dom)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.y = 0.5
    controls.update()
    controls.enableZoom = false

    raycaster = new THREE.Raycaster()
    mouse = new THREE.Vector2()

    window.addEventListener("pointerdown", onPointerDown)

    animate()

    window.addEventListener("resize", resize)
}

function onPointerDown(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(scene.children, true)

    if (intersects.length > 0) {
        const intersect = intersects[0]
        const material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff })

        const geometrySphere = new THREE.IcosahedronGeometry(0.05, 4)
        const sphere = new THREE.Mesh(geometrySphere, material)
        sphere.castShadow = true
        sphere.receiveShadow = true
        sphere.userData.physics = { mass: 5 }

        const spherePosition = new THREE.Vector3()
        camera.getWorldDirection(spherePosition)
        spherePosition.multiplyScalar(2).add(camera.position)
        sphere.position.copy(spherePosition)

        const direction = new THREE.Vector3().subVectors(intersect.point, sphere.position).normalize()
        const velocity = direction.multiplyScalar(10)

        scene.add(sphere)

        physics.addScene(sphere)
        physics.setMeshVelocity(sphere, velocity)
    }
}

function animate() {
    requestAnimationFrame(animate)

    if (scene.userData.modelPairs) {
        for (const { model, physicsBox } of scene.userData.modelPairs) {
            model.position.copy(physicsBox.position)
            model.quaternion.copy(physicsBox.quaternion)
        }
    }

    renderer.render(scene, camera)
    stats.update()
}

function resize() {
    width = container.offsetWidth
    height = container.offsetHeight

    camera.aspect = width / height
    camera.updateProjectionMatrix()

    renderer.setSize(width, height)
}
