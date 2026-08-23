import { useGLTF } from "@react-three/drei";

export default function Classroom() {
    const { scene } = useGLTF("/models/CLASSROOM.glb");

    return <primitive object={scene} />;
}

useGLTF.preload("/models/CLASSROOM.glb");