import React, { useState, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

function Ball({ position, leftArmRaised, rightArmRaised, side }) {
  const meshRef = useRef()
  const baseY = 0.2 // Base height for stationary balls
  const [targetY, setTargetY] = useState(baseY)
  const [currentY, setCurrentY] = useState(baseY)

  useEffect(() => {
    if (side === 'left' && leftArmRaised) {
      setTargetY(baseY + 2)
    } else if (side === 'right' && rightArmRaised) {
      setTargetY(baseY + 2)
    } else {
      setTargetY(baseY) // Return to base position when arm is down
    }
  }, [leftArmRaised, rightArmRaised, side])

  useFrame(() => {
    if (meshRef.current) {
      const diff = targetY - currentY
      const newY = currentY + diff * 0.1
      setCurrentY(newY)
      meshRef.current.position.y = newY

      // Color change based on arm state
      const isRaised = (side === 'left' && leftArmRaised) || (side === 'right' && rightArmRaised)
      meshRef.current.material.color.setHex(isRaised ? 0x00ff00 : 0xff6b6b)
    }
  })

  return (
    <mesh ref={meshRef} position={[position[0], currentY, position[2]]}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial color={0xff6b6b} />
    </mesh>
  )
}

function BallScene({ leftArmRaised, rightArmRaised, cameraAngle = 'default' }) {
  // Fixed ball positions for consistency across tabs
  const leftBalls = [
    [-4, 0.2, -2],
    [-3.5, 0.2, 0],
    [-4.2, 0.2, 2],
    [-3.8, 0.2, -1],
    [-3.3, 0.2, 1]
  ]

  const rightBalls = [
    [4, 0.2, -2],
    [3.5, 0.2, 0],
    [4.2, 0.2, 2],
    [3.8, 0.2, -1],
    [3.3, 0.2, 1]
  ]

  // Define different camera positions based on angle
  const getCameraPosition = () => {
    switch (cameraAngle) {
      case 'front':
        return [0, 3, 8]
      case 'back':
        return [0, 3, -8]
      case 'left':
        return [-8, 3, 0]
      case 'right':
        return [8, 3, 0]
      case 'top':
        return [0, 10, 0]
      default:
        return [0, 3, 8]
    }
  }

  return (
    <Canvas camera={{ position: getCameraPosition(), fov: 60 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color={0x8fbc8f} />
      </mesh>

      {/* Left side balls */}
      {leftBalls.map((position, index) => (
        <Ball
          key={`left-${index}`}
          position={position}
          leftArmRaised={leftArmRaised}
          rightArmRaised={rightArmRaised}
          side="left"
        />
      ))}

      {/* Right side balls */}
      {rightBalls.map((position, index) => (
        <Ball
          key={`right-${index}`}
          position={position}
          leftArmRaised={leftArmRaised}
          rightArmRaised={rightArmRaised}
          side="right"
        />
      ))}

      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
    </Canvas>
  )
}

export default BallScene