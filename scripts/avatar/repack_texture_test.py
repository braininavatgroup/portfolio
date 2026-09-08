import unittest
import numpy as np
from repack_avatar_texture import repack_texture

class RepackTextureTest(unittest.TestCase):
    def test_isolates_colors_with_padding_and_preserves_inputs(self):
        image = np.zeros((16, 16, 3), dtype=np.uint8)
        image[:, :8] = [240, 0, 0]
        image[:, 8:] = [0, 0, 240]
        uv = np.array([[.1,.1],[.3,.1],[.1,.3],[.65,.1],[.85,.1],[.65,.3]], dtype=np.float32)
        original = uv.copy()
        atlas, result = repack_texture(image, uv, np.array([[0,1,2],[3,4,5]]), 32, 3)
        np.testing.assert_array_equal(uv, original)
        for i, color in [(0,[240,0,0]), (3,[0,0,240])]:
            x,y = np.floor(result[i] * 32).astype(int)
            np.testing.assert_array_equal(atlas[y,x-1], color)
        self.assertTrue(np.all((result >= 0) & (result <= 1)))

    def test_rejects_an_atlas_that_cannot_fit_the_padded_patches(self):
        with self.assertRaisesRegex(ValueError, 'fit'):
            repack_texture(np.zeros((16,16,3),dtype=np.uint8),np.array([[0,0],[1,0],[0,1]]),np.array([[0,1,2]]),8,4)

if __name__ == '__main__':
    unittest.main()
