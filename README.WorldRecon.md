# WorldRecon

**Generative Multi-View Mesh Reconstruction for Large-Scale 3D World**

WorldRecon reconstructs complete, large-scale 3D scene meshes with PBR materials from unposed multi-view RGB images. It uses a coarse global point cloud and estimated camera poses as a scaffold, then generates overlapping scene blocks with reconstruction-based conditioning. Neighbour-aware latent inpainting and causal world generation help maintain structural, geometric, and material consistency across the scene.

## Highlights

- Reconstructs complete scene meshes from unposed multi-view images.
- Generates detailed geometry and PBR materials block by block.
- Maintains consistency across large indoor scenes through neighbour-aware context propagation.
- Generalizes from synthetic training data to real-world scenes.

## Results

On 30 held-out scenes from each dataset, WorldRecon reduces Chamfer distance by **14.9%** on 3D-FRONT and **43.1%** on ScanNet++, while improving F-score by **17.3%** and **12.0%**, respectively, over the strongest baselines.

## Resources

- [Project page](https://kszpxxzmc.github.io/WorldRecon-website/)
- [Paper](https://kszpxxzmc.github.io/WorldRecon-website/WorldRecon.pdf)

## Code

Code and pretrained models are not included in this repository yet. They will be released at a later time.
