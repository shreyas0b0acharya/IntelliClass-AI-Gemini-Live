"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export function CameraLogger() {
    const { camera, controls } = useThree();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== "p") return;

            console.log("CAMERA POSITION:");
            console.log([
                Number(camera.position.x.toFixed(3)),
                Number(camera.position.y.toFixed(3)),
                Number(camera.position.z.toFixed(3)),
            ]);

            if (controls) {
                const orbitControls = controls as OrbitControlsImpl;

                console.log("ORBIT CONTROLS TARGET:");
                console.log([
                    Number(orbitControls.target.x.toFixed(3)),
                    Number(orbitControls.target.y.toFixed(3)),
                    Number(orbitControls.target.z.toFixed(3)),
                ]);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [camera, controls]);

    return null;
}